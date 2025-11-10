export type FeatureVector = Record<string, number>;

export interface ScalerDefinition {
  mean: number[];
  std: number[];
}

export interface SerializedModel {
  version: string;
  features: string[];
  weights: number[];
  bias: number;
  scaler: ScalerDefinition;
  threshold: number;
}

export interface ModelFileSchema {
  model: SerializedModel;
}
