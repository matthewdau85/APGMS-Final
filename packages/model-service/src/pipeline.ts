import * as tf from '@tensorflow/tfjs';

export interface ModelConfig {
  /** Number of input features provided to the model. */
  inputSize: number;
  /** Units in the hidden dense layer. */
  hiddenUnits: number;
  /** Learning rate used by the optimizer. */
  learningRate: number;
}

export interface ModelMetadata {
  name: string;
  description: string;
  createdAt: Date;
}

/**
 * Creates a baseline sequential model that can be used for tabular classification tasks.
 */
export function createBaselineModel(config: ModelConfig): tf.Sequential {
  if (config.inputSize <= 0) {
    throw new Error('inputSize must be greater than zero');
  }

  const model = tf.sequential();
  model.add(
    tf.layers.dense({
      units: config.hiddenUnits,
      activation: 'relu',
      inputShape: [config.inputSize]
    })
  );
  model.add(
    tf.layers.dense({
      units: 1,
      activation: 'sigmoid'
    })
  );

  model.compile({
    optimizer: tf.train.adam(config.learningRate),
    loss: 'binaryCrossentropy',
    metrics: ['accuracy']
  });

  return model;
}

/**
 * Warms up the model by running a dummy prediction. This helps avoid the
 * first-inference penalty when the service receives real traffic.
 */
export async function warmupModel(model: tf.LayersModel, inputSize: number): Promise<void> {
  const sample = tf.zeros([1, inputSize]);

  try {
    const prediction = model.predict(sample);
    if (Array.isArray(prediction)) {
      await Promise.all(prediction.map(async (tensor) => tensor.data()));
      prediction.forEach((tensor) => tensor.dispose());
    } else if (prediction) {
      await prediction.data();
      prediction.dispose();
    }
  } finally {
    sample.dispose();
  }
}

/**
 * Performs a forward pass on the supplied samples and returns plain number results.
 */
export async function predictScores(model: tf.LayersModel, samples: number[][]): Promise<number[]> {
  if (samples.length === 0) {
    return [];
  }

  const input = tf.tensor2d(samples);

  try {
    const output = model.predict(input);

    if (!output) {
      return [];
    }

    if (Array.isArray(output)) {
      const first = output[0];
      const values = await first.data();
      output.forEach((tensor) => tensor.dispose());
      return Array.from(values);
    }

    const values = await output.data();
    output.dispose();
    return Array.from(values);
  } finally {
    input.dispose();
  }
}

export function describeModel(model: tf.LayersModel): ModelMetadata {
  return {
    name: model.name ?? 'baseline-model',
    description: 'Baseline dense neural network for scoring.',
    createdAt: new Date()
  };
}
