import type { JwtSignOptions } from '@nestjs/jwt';
import Joi from 'joi';
import ms from 'ms';

type JwtExpiresIn = Extract<
  NonNullable<JwtSignOptions['expiresIn']>,
  string
>;

const MIN_JWT_EXPIRY_MS = 60 * 1000;
const MAX_JWT_EXPIRY_MS = 24 * 60 * 60 * 1000;

export interface EnvironmentVariables {
  PORT: number;
  DATABASE_URL: string;
  REDIS_HOST: string;
  REDIS_PORT: number;
  CORS_ORIGIN: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: JwtExpiresIn;
}

function validateJwtExpiry(
  value: string,
  helpers: Joi.CustomHelpers<JwtExpiresIn>,
): JwtExpiresIn | Joi.ErrorReport {
  const durationMs: number | undefined = ms(value as JwtExpiresIn);

  if (
    durationMs === undefined ||
    durationMs < MIN_JWT_EXPIRY_MS ||
    durationMs > MAX_JWT_EXPIRY_MS
  ) {
    return helpers.error('any.invalid');
  }

  return value as JwtExpiresIn;
}

const environmentSchema = Joi.object({
  PORT: Joi.number().port().default(3000),
  DATABASE_URL: Joi.string().required(),
  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().port().default(6379),
  CORS_ORIGIN: Joi.string().uri().required(),
  JWT_SECRET: Joi.string().min(24).required(),
  JWT_EXPIRES_IN: Joi.string()
    .custom(validateJwtExpiry, 'JWT expiry validation')
    .default('1h')
    .messages({
      'any.invalid':
        '{{#label}} must be a supported duration between 1m and 24h',
    }),
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
