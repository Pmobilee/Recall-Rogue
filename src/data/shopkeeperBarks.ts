/**
 * Shopkeeper bark lines — context-sensitive one-liners for the shop room.
 * Each trigger has 3-5 variants. One is randomly selected per trigger event.
 */

export type ShopBarkTrigger =
  | 'enter_shop'
  | 'browse_relic'
  | 'browse_card'
  | 'tap_unaffordable'
  | 'purchase'
  | 'sell'
  | 'initiate_removal'
  | 'confirm_removal'
  | 'cancel_removal'
  | 'initiate_transform'
  | 'transform_options_revealed'
  | 'confirm_transform_high'
  | 'confirm_transform_low'
  | 'cancel_transform'
  | 'price_escalated'
  | 'leave_with_gold'
  | 'leave_broke'
  | 'leave_bought';

export const SHOPKEEPER_BARKS: Record<ShopBarkTrigger, string[]> = {
  enter_shop: [
    "Step closer, wanderer. Knowledge has a price.",
    "Ah, a customer. Browse freely.",
    "The deeper you go, the better my stock.",
    "Welcome back. I've been expecting you.",
    "Every card tells a story. Care to buy one?",
  ],
  browse_relic: [
    "That one? Pulled it from the rubble below.",
    "A fine choice for those who survive long enough to use it.",
    "I found that in the bones of a scholar.",
    "Careful — that one has a temper.",
  ],
  browse_card: [
    "Sharp mind, sharp blade. Same thing down here.",
    "That card's been popular with the regulars.",
    "Knowledge is power — literally, in your case.",
    "A solid pick. I've seen it turn the tide.",
  ],
  tap_unaffordable: [
    "Your purse is light. Delve deeper and return.",
    "The dungeon always pays — if you're brave enough.",
    "Can't afford it? The knowledge isn't going anywhere.",
    "Come back when your pockets are heavier.",
  ],
  purchase: [
    "A fine choice. May it serve you in the dark.",
    "Pleasure doing business.",
    "Use it well — no refunds.",
    "That one will serve you well. I can feel it.",
    "Sold. Now make it count.",
  ],
  sell: [
    "Barely worth the dust on my counter.",
    "I'll take it. Don't expect a fortune.",
    "One scholar's trash, another's... well, still trash. But I'll take it.",
    "Fair enough. Gold is gold.",
  ],
  initiate_removal: [
    "Lighter deck, sharper mind. Choose wisely.",
    "Destruction is a kind of creation, they say.",
    "Sometimes less is more. Which card offends you?",
  ],
  confirm_removal: [
    "Gone. As if it never was.",
    "The flames take what they will.",
    "Ashes to ashes. Your deck thanks you.",
  ],
  cancel_removal: [
    "Changed your mind? Wise, perhaps.",
    "Cold feet? Understandable.",
    "The card lives to fight another day.",
  ],
  initiate_transform: [
    "Feeling lucky, wanderer? Transformation is a gamble.",
    "The cards shift and change. Let's see what fate offers.",
    "Transmutation is an art. And art is unpredictable.",
  ],
  transform_options_revealed: [
    "Three paths — only one is yours.",
    "Choose carefully. Not all change is improvement.",
    "The fates have spoken. Now you decide.",
  ],
  confirm_transform_high: [
    "Fortune favors you — today.",
    "Fascinating. Even I couldn't have predicted that outcome.",
    "Now that's a transformation worth paying for.",
  ],
  confirm_transform_low: [
    "Hmm. At least it's... different.",
    "Not every transformation is an improvement. But you knew that.",
    "Well, you can't win them all.",
  ],
  cancel_transform: [
    "A bold choice — to walk away with nothing. Or a foolish one.",
    "Gone — card and gold both. A harsh lesson.",
    "The void keeps what it takes.",
  ],
  price_escalated: [
    "My services grow dearer with each use, wanderer.",
    "Supply and demand — even down here.",
    "Quality costs. Especially the second time.",
  ],
  leave_with_gold: [
    "Leave empty-handed? The dark shows no mercy to the unprepared.",
    "You'll be back. They always come back.",
    "Saving for a rainy day? It's always raining down here.",
  ],
  leave_broke: [
    "Travel safe. I'll have fresh stock next time.",
    "Go earn some gold. I'll be here.",
    "The dungeon provides — if you survive.",
  ],
  leave_bought: [
    "Good luck down there. You'll need it.",
    "May your cards serve you well.",
    "Until next time, wanderer.",
  ],
};

/**
 * Get a random bark for the given trigger.
 */
export function getShopkeeperBark(trigger: ShopBarkTrigger): string {
  const lines = SHOPKEEPER_BARKS[trigger];
  return lines[Math.floor(Math.random() * lines.length)];
}
