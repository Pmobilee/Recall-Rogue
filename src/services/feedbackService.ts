import { authedPost } from './authedFetch'

export interface FeedbackSubmission {
  userId: string
  feedback: string
  accountId?: string | null
  timestamp: number
}

export const feedbackService = {
  async submit(payload: FeedbackSubmission): Promise<void> {
    await authedPost('/feedback', payload)
  },
}
