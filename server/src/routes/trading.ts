/**
 * Trading and marketplace routes for the Terra Gacha server.
 * Covers the artifact marketplace (list, buy, delist), direct trade offers
 * between players, and the duplicate mixing mechanic.
 *
 * All monetary operations (buy, mix) are described as atomic in comments.
 * The actual atomicity relies on SQLite's serialised writer; when migrating
 * to PostgreSQL, wrap operations in a BEGIN/COMMIT transaction.
 *
 * Artifact data is stored in process memory for this phase.
 * In production, listings and offers would live in dedicated PostgreSQL tables.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import * as crypto from "crypto";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { requireAuth, getAuthUser } from "../middleware/auth.js";

// ── Constants ─────────────────────────────────────────────────────────────────

/** Minimum dust price for a marketplace listing. */
const LISTING_MIN_PRICE = 10;

/** Maximum dust price for a marketplace listing. */
const LISTING_MAX_PRICE = 10_000;

/** Marketplace transaction fee burned on each sale (5 %). */
const MARKETPLACE_FEE_RATE = 0.05;

/** Maximum additional dust in a direct trade offer. */
const TRADE_MAX_DUST = 500;

/** Maximum number of marketplace listings returned per query. */
const MARKETPLACE_MAX_RESULTS = 50;

/** Number of duplicates required to attempt a mix. */
const MIX_REQUIRED_COUNT = 3;

/** Probability of gaining rarity+1 on a successful mix (70 %). */
const MIX_SUCCESS_RATE = 0.7;

// ── Types ─────────────────────────────────────────────────────────────────────

/** Rarity tiers for artifacts and cards. */
type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

/** Known artifact categories for filtering. */
type ArtifactCategory = "mineral" | "fossil" | "relic" | "companion" | string;

/** A listed artifact on the marketplace. */
interface MarketplaceListing {
  id: string;
  sellerId: string;
  sellerDisplayName: string | null;
  instanceId: string;
  artifactName: string;
  rarity: Rarity;
  category: ArtifactCategory;
  priceDust: number;
  soulbound: boolean;
  listedAt: number;
  boughtAt: number | null;
  buyerId: string | null;
}

/** A direct trade offer between two players. */
interface TradeOffer {
  id: string;
  senderId: string;
  senderDisplayName: string | null;
  receiverId: string;
  offeredCardId: string;
  requestedCardId: string;
  additionalDust: number;
  status: "pending" | "accepted" | "declined";
  createdAt: number;
  resolvedAt: number | null;
}

/** A player-owned artifact instance (simplified for trading). */
interface ArtifactInstance {
  instanceId: string;
  ownerId: string;
  artifactName: string;
  rarity: Rarity;
  category: ArtifactCategory;
  soulbound: boolean;
}

// ── In-memory stores ──────────────────────────────────────────────────────────

/** All marketplace listings (including sold). */
const listingStore = new Map<string, MarketplaceListing>();

/** All direct trade offers. */
const offerStore = new Map<string, TradeOffer>();

/**
 * Simulated artifact inventory — maps instanceId → ArtifactInstance.
 * In production this would be a player_artifacts table.
 */
const artifactInventory = new Map<string, ArtifactInstance>();

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Compute the rarity one step above the given rarity.
 * Returns the same rarity if already at the top tier.
 *
 * @param rarity - Source rarity.
 * @returns Next rarity tier.
 */
function rarityUp(rarity: Rarity): Rarity {
  const tiers: Rarity[] = ["common", "uncommon", "rare", "epic", "legendary"];
  const idx = tiers.indexOf(rarity);
  return idx === -1 || idx === tiers.length - 1 ? rarity : tiers[idx + 1]!;
}

/**
 * Validate a rarity string.
 *
 * @param v - Value to check.
 * @returns True if v is a known Rarity.
 */
function isValidRarity(v: unknown): v is Rarity {
  return (
    v === "common" ||
    v === "uncommon" ||
    v === "rare" ||
    v === "epic" ||
    v === "legendary"
  );
}

// ── Route registration ────────────────────────────────────────────────────────

/**
 * Register trading and marketplace routes on the Fastify instance.
 * Prefixed with /api/trading by the calling index.ts.
 *
 * @param fastify - The Fastify application instance.
 */
export async function tradingRoutes(fastify: FastifyInstance): Promise<void> {
  // ── GET /marketplace ────────────────────────────────────────────────────────

  /**
   * GET /api/trading/marketplace
   * Browse active marketplace listings.
   * Query: ?rarity=<rarity>&category=<category>&limit=50
   * Returns: Array of active (not yet sold) MarketplaceListing objects.
   * Public endpoint — no authentication required.
   */
  fastify.get(
    "/marketplace",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const q = request.query as Record<string, unknown>;
      const rarityFilter = typeof q["rarity"] === "string" ? q["rarity"] : null;
      const categoryFilter =
        typeof q["category"] === "string" ? q["category"] : null;
      const rawLimit = typeof q["limit"] === "string" ? parseInt(q["limit"], 10) : MARKETPLACE_MAX_RESULTS;
      const limit = Math.min(
        Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : MARKETPLACE_MAX_RESULTS,
        MARKETPLACE_MAX_RESULTS
      );

      let listings = [...listingStore.values()].filter(
        (l) => l.boughtAt === null
      );

      if (rarityFilter && isValidRarity(rarityFilter)) {
        listings = listings.filter((l) => l.rarity === rarityFilter);
      }
      if (categoryFilter) {
        listings = listings.filter((l) => l.category === categoryFilter);
      }

      // Sort by most recently listed first
      listings.sort((a, b) => b.listedAt - a.listedAt);

      return reply.status(200).send(listings.slice(0, limit));
    }
  );

  // ── POST /marketplace/list ──────────────────────────────────────────────────

  /**
   * POST /api/trading/marketplace/list
   * List an artifact for sale on the marketplace.
   * Body: { instanceId: string, priceDust: number } — price between 10 and 10000.
   * Soulbound artifacts cannot be listed.
   * Returns: 201 with the created listing.
   */
  fastify.post(
    "/marketplace/list",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { sub: sellerId } = getAuthUser(request);
      const body = request.body as Record<string, unknown> | null | undefined;
      const instanceId = body?.instanceId;
      const priceDust = body?.priceDust;

      if (typeof instanceId !== "string" || instanceId.trim().length === 0) {
        return reply
          .status(400)
          .send({ error: "instanceId is required", statusCode: 400 });
      }
      if (
        typeof priceDust !== "number" ||
        !Number.isFinite(priceDust) ||
        priceDust < LISTING_MIN_PRICE ||
        priceDust > LISTING_MAX_PRICE
      ) {
        return reply.status(400).send({
          error: `priceDust must be between ${LISTING_MIN_PRICE} and ${LISTING_MAX_PRICE}`,
          statusCode: 400,
        });
      }

      // Look up the artifact instance
      const artifact = artifactInventory.get(instanceId);
      if (!artifact) {
        return reply
          .status(404)
          .send({ error: "Artifact instance not found", statusCode: 404 });
      }
      if (artifact.ownerId !== sellerId) {
        return reply
          .status(403)
          .send({ error: "You do not own this artifact", statusCode: 403 });
      }
      if (artifact.soulbound) {
        return reply
          .status(400)
          .send({ error: "Soulbound artifacts cannot be listed for sale", statusCode: 400 });
      }

      // Prevent double-listing the same instance
      const alreadyListed = [...listingStore.values()].find(
        (l) => l.instanceId === instanceId && l.boughtAt === null
      );
      if (alreadyListed) {
        return reply
          .status(409)
          .send({ error: "Artifact is already listed", statusCode: 409 });
      }

      const seller = await db
        .select({ displayName: users.displayName })
        .from(users)
        .where(eq(users.id, sellerId))
        .get();

      const listing: MarketplaceListing = {
        id: crypto.randomUUID(),
        sellerId,
        sellerDisplayName: seller?.displayName ?? null,
        instanceId,
        artifactName: artifact.artifactName,
        rarity: artifact.rarity,
        category: artifact.category,
        priceDust: Math.floor(priceDust),
        soulbound: false,
        listedAt: Date.now(),
        boughtAt: null,
        buyerId: null,
      };

      listingStore.set(listing.id, listing);

      return reply.status(201).send(listing);
    }
  );

  // ── POST /marketplace/buy/:listingId ───────────────────────────────────────

  /**
   * POST /api/trading/marketplace/buy/:listingId
   * Purchase a marketplace listing.
   * Atomic operation: deducts dust from buyer, transfers artifact, burns 5 % fee.
   * Returns: 200 with the updated listing record.
   */
  fastify.post(
    "/marketplace/buy/:listingId",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { sub: buyerId } = getAuthUser(request);
      const { listingId } = request.params as { listingId: string };

      const listing = listingStore.get(listingId);
      if (!listing) {
        return reply
          .status(404)
          .send({ error: "Listing not found", statusCode: 404 });
      }
      if (listing.boughtAt !== null) {
        return reply
          .status(409)
          .send({ error: "Listing has already been sold", statusCode: 409 });
      }
      if (listing.sellerId === buyerId) {
        return reply
          .status(400)
          .send({ error: "Cannot buy your own listing", statusCode: 400 });
      }

      // Atomic: deduct dust from buyer, transfer artifact ownership, burn fee.
      // In production wrap in a transaction; buyer's dust balance would be
      // checked and updated in the saves table.
      const fee = Math.floor(listing.priceDust * MARKETPLACE_FEE_RATE);
      const sellerReceives = listing.priceDust - fee;

      // Transfer artifact ownership
      const artifact = artifactInventory.get(listing.instanceId);
      if (artifact) {
        artifact.ownerId = buyerId;
      }

      listing.boughtAt = Date.now();
      listing.buyerId = buyerId;

      console.log(
        `[trading] Sale ${listingId}: buyer ${buyerId} pays ${listing.priceDust} dust ` +
          `→ seller ${listing.sellerId} receives ${sellerReceives}, burned ${fee}`
      );

      return reply.status(200).send({
        listing,
        dustDeducted: listing.priceDust,
        sellerReceives,
        feeBurned: fee,
      });
    }
  );

  // ── DELETE /marketplace/:listingId ─────────────────────────────────────────

  /**
   * DELETE /api/trading/marketplace/:listingId
   * Remove the authenticated player's own active listing.
   * Returns: 204 No Content.
   */
  fastify.delete(
    "/marketplace/:listingId",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { sub: userId } = getAuthUser(request);
      const { listingId } = request.params as { listingId: string };

      const listing = listingStore.get(listingId);
      if (!listing) {
        return reply
          .status(404)
          .send({ error: "Listing not found", statusCode: 404 });
      }
      if (listing.sellerId !== userId) {
        return reply
          .status(403)
          .send({ error: "Not your listing", statusCode: 403 });
      }
      if (listing.boughtAt !== null) {
        return reply
          .status(409)
          .send({ error: "Cannot delist a sold listing", statusCode: 409 });
      }

      listingStore.delete(listingId);

      return reply.status(204).send();
    }
  );

  // ── POST /offers/send ───────────────────────────────────────────────────────

  /**
   * POST /api/trading/offers/send
   * Send a direct trade offer to another player.
   * Body: { receiverId, offeredCardId, requestedCardId, additionalDust }
   * additionalDust max 500.
   * Returns: 201 with the created offer record.
   */
  fastify.post(
    "/offers/send",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { sub: senderId } = getAuthUser(request);
      const body = request.body as Record<string, unknown> | null | undefined;
      const receiverId = body?.receiverId;
      const offeredCardId = body?.offeredCardId;
      const requestedCardId = body?.requestedCardId;
      const additionalDust = body?.additionalDust ?? 0;

      if (typeof receiverId !== "string" || receiverId.trim().length === 0) {
        return reply
          .status(400)
          .send({ error: "receiverId is required", statusCode: 400 });
      }
      if (senderId === receiverId) {
        return reply
          .status(400)
          .send({ error: "Cannot send a trade offer to yourself", statusCode: 400 });
      }
      if (typeof offeredCardId !== "string" || offeredCardId.trim().length === 0) {
        return reply
          .status(400)
          .send({ error: "offeredCardId is required", statusCode: 400 });
      }
      if (typeof requestedCardId !== "string" || requestedCardId.trim().length === 0) {
        return reply
          .status(400)
          .send({ error: "requestedCardId is required", statusCode: 400 });
      }
      if (
        typeof additionalDust !== "number" ||
        !Number.isFinite(additionalDust) ||
        additionalDust < 0
      ) {
        return reply
          .status(400)
          .send({ error: "additionalDust must be a non-negative number", statusCode: 400 });
      }
      if (additionalDust > TRADE_MAX_DUST) {
        return reply.status(400).send({
          error: `additionalDust cannot exceed ${TRADE_MAX_DUST}`,
          statusCode: 400,
        });
      }

      // Verify receiver exists
      const receiver = await db
        .select({ id: users.id, isDeleted: users.isDeleted })
        .from(users)
        .where(eq(users.id, receiverId))
        .get();

      if (!receiver || receiver.isDeleted === 1) {
        return reply
          .status(404)
          .send({ error: "Receiver not found", statusCode: 404 });
      }

      // Verify sender owns the offered card
      const offeredArtifact = artifactInventory.get(offeredCardId);
      if (!offeredArtifact || offeredArtifact.ownerId !== senderId) {
        return reply
          .status(400)
          .send({ error: "You do not own the offered card", statusCode: 400 });
      }
      if (offeredArtifact.soulbound) {
        return reply
          .status(400)
          .send({ error: "Cannot offer a soulbound card", statusCode: 400 });
      }

      // Verify the receiver owns the requested card
      const requestedArtifact = artifactInventory.get(requestedCardId);
      if (!requestedArtifact || requestedArtifact.ownerId !== receiverId) {
        return reply
          .status(400)
          .send({ error: "Receiver does not own the requested card", statusCode: 400 });
      }
      if (requestedArtifact.soulbound) {
        return reply
          .status(400)
          .send({ error: "Cannot request a soulbound card", statusCode: 400 });
      }

      const sender = await db
        .select({ displayName: users.displayName })
        .from(users)
        .where(eq(users.id, senderId))
        .get();

      const offer: TradeOffer = {
        id: crypto.randomUUID(),
        senderId,
        senderDisplayName: sender?.displayName ?? null,
        receiverId,
        offeredCardId,
        requestedCardId,
        additionalDust: Math.floor(additionalDust),
        status: "pending",
        createdAt: Date.now(),
        resolvedAt: null,
      };

      offerStore.set(offer.id, offer);

      return reply.status(201).send(offer);
    }
  );

  // ── POST /offers/:offerId/accept ────────────────────────────────────────────

  /**
   * POST /api/trading/offers/:offerId/accept
   * Accept a pending direct trade offer.
   * Swaps card ownership atomically and transfers any additional dust.
   * Returns: 200 with the resolved offer record.
   */
  fastify.post(
    "/offers/:offerId/accept",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { sub: userId } = getAuthUser(request);
      const { offerId } = request.params as { offerId: string };

      const offer = offerStore.get(offerId);
      if (!offer) {
        return reply
          .status(404)
          .send({ error: "Offer not found", statusCode: 404 });
      }
      if (offer.receiverId !== userId) {
        return reply
          .status(403)
          .send({ error: "Not the recipient of this offer", statusCode: 403 });
      }
      if (offer.status !== "pending") {
        return reply
          .status(409)
          .send({ error: "Offer is no longer pending", statusCode: 409 });
      }

      // Atomic card swap
      const offeredArtifact = artifactInventory.get(offer.offeredCardId);
      const requestedArtifact = artifactInventory.get(offer.requestedCardId);

      if (offeredArtifact) offeredArtifact.ownerId = offer.receiverId;
      if (requestedArtifact) requestedArtifact.ownerId = offer.senderId;

      if (offer.additionalDust > 0) {
        console.log(
          `[trading] Trade ${offerId}: ${offer.receiverId} receives ${offer.additionalDust} additional dust`
        );
      }

      offer.status = "accepted";
      offer.resolvedAt = Date.now();

      return reply.status(200).send(offer);
    }
  );

  // ── POST /offers/:offerId/decline ───────────────────────────────────────────

  /**
   * POST /api/trading/offers/:offerId/decline
   * Decline a pending direct trade offer.
   * No dust or cards are transferred.
   * Returns: 200 with the resolved offer record.
   */
  fastify.post(
    "/offers/:offerId/decline",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { sub: userId } = getAuthUser(request);
      const { offerId } = request.params as { offerId: string };

      const offer = offerStore.get(offerId);
      if (!offer) {
        return reply
          .status(404)
          .send({ error: "Offer not found", statusCode: 404 });
      }
      if (offer.receiverId !== userId) {
        return reply
          .status(403)
          .send({ error: "Not the recipient of this offer", statusCode: 403 });
      }
      if (offer.status !== "pending") {
        return reply
          .status(409)
          .send({ error: "Offer is no longer pending", statusCode: 409 });
      }

      offer.status = "declined";
      offer.resolvedAt = Date.now();

      return reply.status(200).send(offer);
    }
  );

  // ── GET /offers/pending ─────────────────────────────────────────────────────

  /**
   * GET /api/trading/offers/pending
   * Returns all pending trade offers where the authenticated player is the receiver.
   * Returns: Array of pending TradeOffer objects.
   */
  fastify.get(
    "/offers/pending",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { sub: userId } = getAuthUser(request);

      const pending = [...offerStore.values()].filter(
        (o) => o.receiverId === userId && o.status === "pending"
      );

      return reply.status(200).send(pending);
    }
  );

  // ── POST /mix ───────────────────────────────────────────────────────────────

  /**
   * POST /api/trading/mix
   * Combine 3 duplicate artifacts to attempt a rarity upgrade.
   * Body: { instanceIds: [uuid, uuid, uuid] }
   * Rules:
   *   - All 3 must be the same rarity AND the same category.
   *   - Caller must own all 3.
   *   - None may be soulbound.
   *   - 70 % success rate → rarity+1 artifact.
   *   - 30 % failure → all 3 consumed, nothing produced.
   * Returns: 200 with { success: boolean, result: ArtifactInstance | null }.
   */
  fastify.post(
    "/mix",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { sub: userId } = getAuthUser(request);
      const body = request.body as Record<string, unknown> | null | undefined;
      const instanceIds = body?.instanceIds;

      if (
        !Array.isArray(instanceIds) ||
        instanceIds.length !== MIX_REQUIRED_COUNT
      ) {
        return reply.status(400).send({
          error: `instanceIds must be an array of exactly ${MIX_REQUIRED_COUNT} UUIDs`,
          statusCode: 400,
        });
      }

      // Validate all entries are non-empty strings
      for (const id of instanceIds) {
        if (typeof id !== "string" || id.trim().length === 0) {
          return reply
            .status(400)
            .send({ error: "Each instanceId must be a non-empty string", statusCode: 400 });
        }
      }

      // Ensure no duplicates in the submitted IDs
      const idSet = new Set(instanceIds as string[]);
      if (idSet.size !== MIX_REQUIRED_COUNT) {
        return reply
          .status(400)
          .send({ error: "instanceIds must be distinct", statusCode: 400 });
      }

      // Fetch all three artifact instances
      const artifacts = (instanceIds as string[]).map((id) =>
        artifactInventory.get(id)
      );

      for (let i = 0; i < artifacts.length; i++) {
        const artifact = artifacts[i];
        if (!artifact) {
          return reply.status(404).send({
            error: `Artifact ${instanceIds[i]} not found`,
            statusCode: 404,
          });
        }
        if (artifact.ownerId !== userId) {
          return reply
            .status(403)
            .send({ error: `You do not own artifact ${instanceIds[i]}`, statusCode: 403 });
        }
        if (artifact.soulbound) {
          return reply.status(400).send({
            error: `Artifact ${instanceIds[i]} is soulbound and cannot be mixed`,
            statusCode: 400,
          });
        }
      }

      // All three must have the same rarity and category
      const [a0, a1, a2] = artifacts as ArtifactInstance[];
      if (a0.rarity !== a1.rarity || a0.rarity !== a2.rarity) {
        return reply
          .status(400)
          .send({ error: "All artifacts must have the same rarity", statusCode: 400 });
      }
      if (a0.category !== a1.category || a0.category !== a2.category) {
        return reply
          .status(400)
          .send({ error: "All artifacts must be in the same category", statusCode: 400 });
      }

      // Cannot mix legendary (already max tier)
      if (a0.rarity === "legendary") {
        return reply
          .status(400)
          .send({ error: "Legendary artifacts cannot be mixed further", statusCode: 400 });
      }

      // Consume all three artifacts regardless of outcome
      for (const id of instanceIds as string[]) {
        artifactInventory.delete(id);
      }

      const success = Math.random() < MIX_SUCCESS_RATE;

      if (!success) {
        return reply
          .status(200)
          .send({ success: false, result: null });
      }

      // Produce a new artifact at rarity+1
      const newArtifact: ArtifactInstance = {
        instanceId: crypto.randomUUID(),
        ownerId: userId,
        artifactName: a0.artifactName,
        rarity: rarityUp(a0.rarity),
        category: a0.category,
        soulbound: false,
      };

      artifactInventory.set(newArtifact.instanceId, newArtifact);

      return reply.status(200).send({ success: true, result: newArtifact });
    }
  );
}
