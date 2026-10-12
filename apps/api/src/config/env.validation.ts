import { plainToInstance, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsString,
  Max,
  Min,
  Validate,
  ValidatorConstraint,
  validateSync,
} from 'class-validator';
import type { ValidationArguments, ValidatorConstraintInterface } from 'class-validator';

export const NODE_ENVIRONMENTS = ['development', 'test', 'production'] as const;
export type NodeEnvironment = (typeof NODE_ENVIRONMENTS)[number];

/**
 * Accepts exactly one browser origin such as `http://localhost:5173`:
 * http(s) scheme, a host, an optional port and nothing else (no path, no trailing slash, no `*`).
 */
@ValidatorConstraint({ name: 'isSingleHttpOrigin' })
class IsSingleHttpOrigin implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string' || value.includes('*')) return false;
    try {
      const url = new URL(value);
      return (url.protocol === 'http:' || url.protocol === 'https:') && url.origin === value;
    } catch {
      return false;
    }
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} must be a single http(s) origin such as http://localhost:5173 (no path, trailing slash or wildcard)`;
  }
}

/** Every environment variable the API reads. Validated once at startup. */
export class EnvironmentVariables {
  @IsIn(NODE_ENVIRONMENTS)
  NODE_ENV: NodeEnvironment = 'development';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT = 3000;

  @IsString()
  @Validate(IsSingleHttpOrigin)
  CORS_ORIGIN!: string;
}

const ENV_KEYS = ['NODE_ENV', 'PORT', 'CORS_ORIGIN'] as const;

/**
 * Used by ConfigModule.forRoot({ validate }). Picks the variables declared above from
 * process.env/.env, converts them to typed values and stops startup with one readable
 * message if anything is invalid. Unset variables fall back to the class defaults.
 */
export function validateEnv(raw: Record<string, unknown>): EnvironmentVariables {
  const picked: Record<string, unknown> = {};
  for (const key of ENV_KEYS) {
    if (raw[key] !== undefined) picked[key] = raw[key];
  }

  const env = plainToInstance(EnvironmentVariables, picked, { exposeDefaultValues: true });
  const errors = validateSync(env);

  if (errors.length > 0) {
    const details = errors
      .flatMap((error) => Object.values(error.constraints ?? {}))
      .map((message) => `- ${message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  return env;
}
