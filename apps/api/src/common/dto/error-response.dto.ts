import { ApiProperty } from '@nestjs/swagger';

/**
 * Standard error body, matching what Nest's built-in HttpExceptions produce,
 * e.g. { "statusCode": 404, "error": "Not Found", "message": "Cannot GET /api/v1/unknown" }.
 * Validation failures (400) return `message` as an array of strings.
 */
export class ErrorResponseDto {
  @ApiProperty({ example: 400 })
  statusCode!: number;

  @ApiProperty({ example: 'Bad Request' })
  error!: string;

  @ApiProperty({
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
    example: ['property foo should not exist'],
  })
  message!: string | string[];
}
