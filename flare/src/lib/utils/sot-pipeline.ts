/**
 * Utility functions for the SoT (Sketch-of-Thought) causal prompting pipeline.
 * Uses the /api/chat endpoint for LLM calls.
 */

/**
 * Call the chat API with a specific prompt and optional system prompt.
 */
export async function callChatAPI(prompt: string, systemPrompt?: string): Promise<string> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: prompt,
      options: systemPrompt ? { systemPrompt } : {},
    }),
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }

  const result = await res.text();
  return result.trim();
}

/**
 * Generate a Sketch-of-Thought for a given question.
 * Uses the LLM to create a concise reasoning sketch.
 */
export async function generateSoT(question: string, temperature: number): Promise<string> {
  const systemPrompt = `You are a math problem solver. When given a word problem, create a brief sketch of your reasoning approach in 2-3 sentences. Focus on:
1. Identifying the key numbers and what they represent
2. The mathematical operations needed
3. The logical steps to reach the answer

Be concise and clear.`;

  const prompt = `Create a brief reasoning sketch for this math problem:

"${question}"

Sketch of Thought:`;

  try {
    const response = await callChatAPI(prompt, systemPrompt);
    return `[T=${temperature.toFixed(2)}] ${response}`;
  } catch {
    // Fallback to mock if API fails
    return `[T=${temperature.toFixed(2)}] Identify quantities, calculate step by step, find total.`;
  }
}

/**
 * Generate a Sketch-of-Thought synchronously (mock version for embedding).
 */
export function generateSoTSync(question: string, temperature: number): string {
  const steps = [
    'First, identify the key numbers in the problem.',
    'Determine the relationship between quantities.',
    'Calculate intermediate values.',
    'Compute the final answer.',
  ];
  const numSteps = Math.max(2, Math.min(4, Math.floor(2 + temperature)));
  return `[T=${temperature.toFixed(2)}] ${steps.slice(0, numSteps).join(' ')}`;
}

/**
 * Compute a simple embedding for text by hashing characters.
 * In production, this would use a proper embedding model.
 */
export function embed(text: string): number[] {
  const dims = 8;
  const embedding = new Array(dims).fill(0);

  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    const dimIndex = i % dims;
    embedding[dimIndex] += Math.sin(charCode * 0.1) * Math.cos(i * 0.05);
  }

  const magnitude = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0)) || 1;
  return embedding.map((v) => v / magnitude);
}

/**
 * Compute Euclidean distance between two vectors.
 */
function euclideanDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += (a[i] - b[i]) ** 2;
  }
  return Math.sqrt(sum);
}

/**
 * Perform k-means clustering on points.
 */
export function kMeans(
  points: number[][],
  k: number,
  maxIterations = 20
): { assignments: number[]; centroids: number[][] } {
  const n = points.length;
  const dims = points[0]?.length ?? 0;

  if (n === 0 || dims === 0) {
    return { assignments: [], centroids: [] };
  }

  const centroids: number[][] = points.slice(0, k).map((p) => [...p]);
  let assignments = new Array(n).fill(0);

  for (let iter = 0; iter < maxIterations; iter++) {
    const newAssignments: number[] = [];
    for (const point of points) {
      let minDist = Infinity;
      let closestCluster = 0;
      for (let c = 0; c < k; c++) {
        const dist = euclideanDistance(point, centroids[c]);
        if (dist < minDist) {
          minDist = dist;
          closestCluster = c;
        }
      }
      newAssignments.push(closestCluster);
    }

    const changed = newAssignments.some((a, i) => a !== assignments[i]);
    assignments = newAssignments;

    if (!changed) break;

    for (let c = 0; c < k; c++) {
      const clusterPoints = points.filter((_, i) => assignments[i] === c);
      if (clusterPoints.length > 0) {
        for (let d = 0; d < dims; d++) {
          centroids[c][d] = clusterPoints.reduce((sum, p) => sum + p[d], 0) / clusterPoints.length;
        }
      }
    }
  }

  return { assignments, centroids };
}

/**
 * Extract numeric answer from LLM response.
 */
function extractNumericAnswer(response: string): string | null {
  // Look for patterns like "= 72", "is 72", "answer is 72", "#### 72", or just a number at the end
  const patterns = [
    /####\s*(\d+(?:\.\d+)?)/i,
    /(?:final\s+)?answer[:\s]+(?:is\s+)?(\d+(?:\.\d+)?)/i,
    /(?:total|altogether|sum)[:\s]+(?:is\s+)?(\d+(?:\.\d+)?)/i,
    /=\s*(\d+(?:\.\d+)?)\s*$/m,
    /(\d+(?:\.\d+)?)\s*(?:clips|items|total)?\s*$/i,
  ];

  for (const pattern of patterns) {
    const match = response.match(pattern);
    if (match) return match[1];
  }

  // Fallback: find the last number in the response
  const numbers = response.match(/\d+(?:\.\d+)?/g);
  if (numbers && numbers.length > 0) {
    return numbers[numbers.length - 1];
  }

  return null;
}

/**
 * Perform causal intervention: solve the problem using the SoT as guidance.
 * Uses the /api/chat endpoint to get actual solutions.
 */
export async function interveneAndAnswer(
  question: string,
  sot: string,
  numSamples: number
): Promise<{ answers: string[]; correctCount: number; mostCommonAnswer: string }> {
  const answers: string[] = [];

  const systemPrompt = `You are an expert math problem solver. Solve word problems step by step, showing your reasoning clearly. Always end your response with the final answer in the format:

#### [number]

Where [number] is just the numeric answer (no units, no text, just the number).`;

  const prompt = `Solve this math word problem step by step.

Use this reasoning approach as a guide: ${sot}

Problem: "${question}"

Show your work step by step, then provide the final numeric answer ending with #### followed by just the number.`;

  for (let i = 0; i < numSamples; i++) {
    try {
      const response = await callChatAPI(prompt, systemPrompt);
      const answer = extractNumericAnswer(response);
      if (answer) {
        answers.push(answer);
      }
    } catch {
      // Skip failed attempts
    }
  }

  // Count answer frequencies
  const counts = new Map<string, number>();
  for (const ans of answers) {
    counts.set(ans, (counts.get(ans) || 0) + 1);
  }

  // Find most common answer
  let mostCommonAnswer = '';
  let maxCount = 0;
  for (const [ans, count] of counts) {
    if (count > maxCount) {
      maxCount = count;
      mostCommonAnswer = ans;
    }
  }

  // For correctCount, we use consensus (how many agree with most common)
  const correctCount = maxCount;

  return { answers, correctCount, mostCommonAnswer };
}

/**
 * Aggregate voting results with causal weighting.
 */
export function aggregateVotes(
  sots: Array<{
    id: string;
    pRgivenX: number;
    pAgivenDoR: number | null;
    mostCommonAnswer: string;
    isInCentralCluster: boolean;
    clusterId: number | null;
  }>
): Array<{
  answer: string;
  causalWeight: number;
  contributingSots: string[];
  calculation: string;
}> {
  const voteMap = new Map<string, { weight: number; contributors: string[]; terms: string[] }>();

  for (const sot of sots) {
    if (!sot.isInCentralCluster || sot.pAgivenDoR === null || !sot.mostCommonAnswer) continue;

    const causalWeight = sot.pRgivenX * sot.pAgivenDoR;
    const term = `${sot.pRgivenX.toFixed(3)} × ${sot.pAgivenDoR.toFixed(3)}`;
    const existing = voteMap.get(sot.mostCommonAnswer) ?? {
      weight: 0,
      contributors: [],
      terms: [],
    };
    existing.weight += causalWeight;
    existing.contributors.push(sot.id);
    existing.terms.push(term);
    voteMap.set(sot.mostCommonAnswer, existing);
  }

  return Array.from(voteMap.entries())
    .map(([answer, data]) => ({
      answer,
      causalWeight: data.weight,
      contributingSots: data.contributors,
      calculation: data.terms.join(' + ') + ` = ${data.weight.toFixed(4)}`,
    }))
    .sort((a, b) => b.causalWeight - a.causalWeight);
}

/**
 * Sleep utility for simulating async operations.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
