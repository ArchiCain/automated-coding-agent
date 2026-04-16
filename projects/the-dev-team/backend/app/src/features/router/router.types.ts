/** Persisted state of what the router has already routed, so we don't re-spawn agents repeatedly. */
export interface RouterState {
  /** Issue numbers we've already spawned an FE/BE Owner for. */
  routedIssues: number[];
  /** PR numbers we've routed to the Designer keyed by the head commit SHA we routed for. */
  designerRoutedForPrCommit: Record<number, string>;
  /** PR numbers we've routed to the FE Owner keyed by the latest review id we addressed. */
  feOwnerRoutedForPrReview: Record<number, string>;
}

export interface IssueSummary {
  number: number;
  title: string;
  body: string;
  labels: Array<{ name: string }>;
  state: string;
  author?: { login: string };
}

export interface PrReview {
  id: string;
  state: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'DISMISSED' | 'PENDING';
  body: string;
  submittedAt: string;
  author?: { login: string };
}

export interface PrSummary {
  number: number;
  title: string;
  body: string;
  state: string;
  isDraft: boolean;
  headRefName: string;
  headRefOid: string;
  author?: { login: string };
  reviews?: PrReview[];
}
