export type SotStageStatus = 'idle' | 'running' | 'done' | 'error';

export type SotStage = 'generation' | 'clustering' | 'intervention' | 'voting';

export interface SotItem {
  id: string;
  temperature: number;
  text: string;
  embedding: number[];
  clusterId: number | null;
  isInCentralCluster: boolean;
  pRgivenX: number | null; // P(r | X) - probability of this reasoning given the input
  pAgivenDoR: number | null; // P(A | do(r)) - probability of correct answer given intervention
  answers: string[];
  mostCommonAnswer: string; // The most frequent answer from intervention samples
  correctCount: number;
  totalSamples: number;
  stages: {
    generation: SotStageStatus;
    clustering: SotStageStatus;
    intervention: SotStageStatus;
    voting: SotStageStatus;
  };
}

export interface ClusterInfo {
  id: number;
  size: number;
  totalSots: number; // Total number of SoTs (m)
  pRgivenX: number; // |C_k| / m
  isCentral: boolean;
  sotIds: string[]; // IDs of SoTs in this cluster
  dominantAnswer: string | null; // Most common answer from this cluster
  pAgivenDoR: number | null; // P(A | do(r)) for the dominant answer
}

export interface VotingResult {
  answer: string;
  causalWeight: number; // Sum of P(r_k | X) * P(A | do(r_k))
  contributingSots: string[]; // IDs of SoTs that voted for this answer
  calculation: string; // Human-readable calculation string
}

export interface SotPipelineState {
  status: 'idle' | 'running' | 'done' | 'error';
  currentStage: SotStage | null;
  sots: SotItem[];
  clusters: ClusterInfo[];
  votingResults: VotingResult[];
  finalAnswer: string | null;
  finalCausalWeight: number | null;
  error: string | null;
}
