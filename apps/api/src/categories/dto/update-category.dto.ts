import { IsCategoryName } from './category-name';

/**
 * Only the name can change. `type` is deliberately absent: the global ValidationPipe
 * (forbidNonWhitelisted) rejects it as an unknown field, which keeps type immutable.
 * `name` is required, so an empty body is rejected too.
 */
export class UpdateCategoryDto {
  @IsCategoryName()
  name!: string;
}
