// joi@17.1.1 does not publish TypeScript declarations.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Joi = require('joi');

export interface EnvironmentVariables {
  PORT: number;
  DATABASE_URL: string;
  REDIS_HOST: string;
  REDIS_PORT: number;
  CORS_ORIGIN: string;
}

const environmentSchema = Joi.object({
  PORT: Joi.number().port().default(3000),
  DATABASE_URL: Joi.string().required(),
  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().port().default(6379),
  CORS_ORIGIN: Joi.string().uri().required(),
});

export function validateEnvironment(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const { error, value } = environmentSchema.validate(config, {
    abortEarly: false,
    allowUnknown: true,
    stripUnknown: true,
  });

  if (error) {
    throw error;
  }

  return value as EnvironmentVariables;
}
