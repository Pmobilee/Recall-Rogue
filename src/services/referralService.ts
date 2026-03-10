import type { ReferralRecord } from '../data/types'
import { authedGet } from './authedFetch'

export interface ReferralCodePayload {
  code: string
}

export interface ReferralHistoryPayload {
  history: ReferralRecord[]
}

export const referralService = {
  async getMyCode(): Promise<ReferralCodePayload> {
    const response = await authedGet('/referrals/my-code')
    return response.json() as Promise<ReferralCodePayload>
  },

  async getMyHistory(): Promise<ReferralHistoryPayload> {
    const response = await authedGet('/referrals/my-history')
    return response.json() as Promise<ReferralHistoryPayload>
  },
}
