import { multiplierAtElapsed } from "./multiplier";
import type { PlayerBet, RoundPhase, RoundState } from "./types";

export const WAITING_MS = 5_000; // "start counting 5 sec" betting window
export const CRASHED_MS = 3_500; // how long the crashed.gif stays up before the next round
export const TICK_RUNNING_MS = 100;
export const TICK_WAITING_MS = 250;
export const HISTORY_LIMIT = 20;

export const PRIZE_EMOJIS = ["🍓", "⭐", "🎩", "🕯️", "🧣", "🍩", "💎", "🎁", "🍒", "🔥"];

export function pickPrizeEmoji(): string {
  return PRIZE_EMOJIS[Math.floor(Math.random() * PRIZE_EMOJIS.length)];
}

export function freshRound(roundId: number, serverHash: string): RoundState {
  return {
    roundId,
    phase: "waiting",
    multiplier: 1.0,
    crashPoint: null,
    countdownMs: WAITING_MS,
    startedAt: 0,
    history: [],
    bets: [],
    serverHash,
  };
}

/** Advances the round's derived fields (multiplier / countdown) given the current time. Mutates & returns state. */
export function tickRound(state: RoundState, now: number, crashPoint: number): RoundState {
  if (state.phase === "waiting") {
    const elapsed = now - state.startedAt;
    state.countdownMs = Math.max(0, WAITING_MS - elapsed);
  } else if (state.phase === "running") {
    const elapsed = now - state.startedAt;
    state.multiplier = multiplierAtElapsed(elapsed);
    if (state.multiplier >= crashPoint) {
      state.multiplier = crashPoint;
      state.phase = "crashed";
      state.crashPoint = crashPoint;
    }
  }
  return state;
}

export function addBet(state: RoundState, bet: PlayerBet): boolean {
  if (state.phase !== "waiting") return false;
  if (state.bets.some((b) => b.userId === bet.userId)) return false;
  state.bets.push(bet);
  return true;
}

export function cashoutBet(state: RoundState, userId: number, multiplier: number): PlayerBet | null {
  if (state.phase !== "running") return null;
  const bet = state.bets.find((b) => b.userId === userId && b.status === "placed");
  if (!bet) return null;
  bet.status = "won";
  bet.cashedOutAt = multiplier;
  return bet;
}

export function settleLosers(state: RoundState): PlayerBet[] {
  const losers = state.bets.filter((b) => b.status === "placed");
  for (const b of losers) b.status = "lost";
  return losers;
}

export function pushHistory(history: number[], crashPoint: number): number[] {
  return [crashPoint, ...history].slice(0, HISTORY_LIMIT);
}

export function publicRoundView(state: RoundState) {
  return {
    roundId: state.roundId,
    phase: state.phase as RoundPhase,
    multiplier: state.multiplier,
    countdownSeconds: Math.ceil(state.countdownMs / 1000),
    history: state.history,
    serverHash: state.serverHash,
    crashPoint: state.phase === "crashed" ? state.crashPoint : null,
    bets: state.bets.map((b) => ({
      userId: b.userId,
      username: b.username,
      photoUrl: b.photoUrl,
      amount: b.amount,
      multiplier: b.cashedOutAt ?? (state.phase === "running" ? state.multiplier : 1.0),
      status: b.status,
      prizeEmoji: b.prizeEmoji,
    })),
  };
}
