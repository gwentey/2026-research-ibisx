"use client";

import { create } from "zustand";

import type { ExperimentCreate } from "@/lib/api/generated";

// Store UNIQUE du wizard (P3) : l'état vit ici et se projette vers le payload API.
// Un brouillon serveur est enregistré à chaque étape validée (reprise — P5).

export interface ColumnStrategyState {
  strategy:
    | "mean"
    | "median"
    | "most_frequent"
    | "constant"
    | "knn"
    | "iterative"
    | "drop_rows"
    | "drop_column";
  constant_value?: string | number | null;
}

export interface WizardState {
  projectId: string | null;
  datasetId: string | null;
  step: number;
  maxReachedStep: number;
  targetColumn: string | null;
  taskType: "classification" | "regression" | null;
  columnStrategies: Record<string, ColumnStrategyState>;
  testSize: number;
  scalingEnabled: boolean;
  scalingMethod: "standard" | "minmax" | "robust";
  encoding: "onehot" | "ordinal";
  algorithm: string | null;
  preset: string;
  hyperparameters: Record<string, unknown>;
  experimentId: string | null;

  init: (projectId: string, datasetId: string) => void;
  hydrate: (state: Partial<WizardState>) => void;
  set: <K extends keyof WizardState>(key: K, value: WizardState[K]) => void;
  goTo: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  setStrategy: (column: string, strategy: ColumnStrategyState | null) => void;
  reset: () => void;
}

const INITIAL = {
  projectId: null,
  datasetId: null,
  step: 1,
  maxReachedStep: 1,
  targetColumn: null,
  taskType: null,
  columnStrategies: {},
  testSize: 0.2,
  scalingEnabled: true,
  scalingMethod: "standard" as const,
  encoding: "onehot" as const,
  algorithm: null,
  preset: "balanced",
  hyperparameters: {},
  experimentId: null
};

export const useWizardStore = create<WizardState>((set, get) => ({
  ...INITIAL,
  init: (projectId, datasetId) => {
    const current = get();
    if (current.projectId !== projectId || current.datasetId !== datasetId) {
      set({ ...INITIAL, projectId, datasetId });
    }
  },
  hydrate: (state) =>
    set((current) => ({
      ...current,
      ...state,
      maxReachedStep: Math.max(current.maxReachedStep, state.maxReachedStep ?? 1)
    })),
  set: (key, value) => set({ [key]: value } as Partial<WizardState>),
  goTo: (step) => {
    if (step <= get().maxReachedStep) set({ step });
  },
  nextStep: () =>
    set((current) => {
      const step = Math.min(9, current.step + 1);
      return { step, maxReachedStep: Math.max(current.maxReachedStep, step) };
    }),
  prevStep: () => set((current) => ({ step: Math.max(1, current.step - 1) })),
  setStrategy: (column, strategy) =>
    set((current) => {
      const next = { ...current.columnStrategies };
      if (strategy === null) delete next[column];
      else next[column] = strategy;
      return { columnStrategies: next };
    }),
  reset: () => set({ ...INITIAL })
}));

/** L'état sérialisé pour le brouillon serveur. */
export function serializeDraft(state: WizardState): Record<string, unknown> {
  return {
    step: state.step,
    maxReachedStep: state.maxReachedStep,
    targetColumn: state.targetColumn,
    taskType: state.taskType,
    columnStrategies: state.columnStrategies,
    testSize: state.testSize,
    scalingEnabled: state.scalingEnabled,
    scalingMethod: state.scalingMethod,
    encoding: state.encoding,
    algorithm: state.algorithm,
    preset: state.preset,
    hyperparameters: state.hyperparameters
  };
}

/** Projection vers le payload API final (contrat strict backend). */
export function toExperimentCreate(state: WizardState): ExperimentCreate | null {
  if (!state.projectId || !state.datasetId || !state.targetColumn || !state.taskType) {
    return null;
  }
  if (!state.algorithm) return null;
  return {
    project_id: state.projectId,
    dataset_id: state.datasetId,
    algorithm: state.algorithm,
    hyperparameters: state.hyperparameters as never,
    preprocessing: {
      target_column: state.targetColumn,
      task_type: state.taskType,
      test_size: state.testSize,
      random_state: 42,
      column_strategies: state.columnStrategies as never,
      scaling: { enabled: state.scalingEnabled, method: state.scalingMethod },
      encoding: state.encoding
    }
  };
}
