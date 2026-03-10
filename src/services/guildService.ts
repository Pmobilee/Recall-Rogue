import { authedGet, authedPost } from './authedFetch'

export interface GuildMemberRecord {
  userId: string
  displayName: string | null
  role: 'leader' | 'officer' | 'member'
  joinedAt: number
}

export interface GuildChallengeRecord {
  id: string
  title: string
  targetCount: number
  currentCount: number
  completedAt: number | null
}

export interface GuildRecord {
  id: string
  name: string
  tag: string
  emblemId: string
  description: string
  members: GuildMemberRecord[]
  gkp: number
  challenges: GuildChallengeRecord[]
  open: boolean
}

export interface GuildSearchRecord {
  id: string
  name: string
  tag: string
  memberCount: number
  maxMembers: number
  gkp: number
  open: boolean
  description: string
}

export interface CreateGuildInput {
  name: string
  tag: string
  emblemId: string
  description: string
}

export const guildService = {
  async getMyGuild(): Promise<GuildRecord> {
    const response = await authedGet('/guilds/me')
    return response.json() as Promise<GuildRecord>
  },

  async search(query: string): Promise<GuildSearchRecord[]> {
    const params = new URLSearchParams({ q: query.trim() })
    const response = await authedGet(`/guilds/search?${params.toString()}`)
    const payload = (await response.json()) as GuildSearchRecord[] | { guilds?: GuildSearchRecord[] }
    if (Array.isArray(payload)) return payload
    return payload.guilds ?? []
  },

  async joinGuild(guildId: string): Promise<GuildRecord> {
    const response = await authedPost(`/guilds/${encodeURIComponent(guildId)}/join`, {})
    return response.json() as Promise<GuildRecord>
  },

  async createGuild(input: CreateGuildInput): Promise<GuildRecord> {
    const response = await authedPost('/guilds/create', input)
    return response.json() as Promise<GuildRecord>
  },

  async invitePlayer(guildId: string, playerId: string): Promise<{ id: string; status: string }> {
    const response = await authedPost(`/guilds/${encodeURIComponent(guildId)}/invite`, { playerId })
    return response.json() as Promise<{ id: string; status: string }>
  },
}
