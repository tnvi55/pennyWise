import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { Prisma } from '../generated/prisma/client';
import type { CategoryType } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CategoryResponseDto } from './dto/category-response.dto';
import { toCategoryResponse } from './dto/category-response.dto';
import type { CreateCategoryDto } from './dto/create-category.dto';
import type { UpdateCategoryDto } from './dto/update-category.dto';

/** Prisma error codes this service turns into HTTP errors. https://www.prisma.io/docs/orm/reference/error-reference */
const UNIQUE_VIOLATION = 'P2002';
const FOREIGN_KEY_VIOLATION = 'P2003';
const RECORD_NOT_FOUND = 'P2025';

function hasPrismaCode(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

/**
 * Business rules for categories. The database constraints are the source of truth:
 * instead of checking first and writing second (which can race), the service writes
 * and translates a constraint failure into a clear HTTP error.
 */
@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(type?: CategoryType): Promise<CategoryResponseDto[]> {
    const categories = await this.prisma.category.findMany({
      where: type ? { type } : {},
      // Stable order: name, then type (for same-named categories), then id as a final tiebreak.
      orderBy: [{ name: 'asc' }, { type: 'asc' }, { id: 'asc' }],
    });
    return categories.map(toCategoryResponse);
  }

  async create(dto: CreateCategoryDto): Promise<CategoryResponseDto> {
    try {
      const category = await this.prisma.category.create({
        data: { name: dto.name, type: dto.type },
      });
      return toCategoryResponse(category);
    } catch (error) {
      if (hasPrismaCode(error, UNIQUE_VIOLATION)) {
        throw new ConflictException(`Category "${dto.name}" (${dto.type}) already exists`);
      }
      throw error;
    }
  }

  async rename(id: string, dto: UpdateCategoryDto): Promise<CategoryResponseDto> {
    try {
      const category = await this.prisma.category.update({
        where: { id },
        data: { name: dto.name },
      });
      return toCategoryResponse(category);
    } catch (error) {
      if (hasPrismaCode(error, RECORD_NOT_FOUND)) throw categoryNotFound(id);
      if (hasPrismaCode(error, UNIQUE_VIOLATION)) {
        throw new ConflictException(
          `Another category of the same type is already named "${dto.name}"`,
        );
      }
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    try {
      await this.prisma.category.delete({ where: { id } });
    } catch (error) {
      if (hasPrismaCode(error, RECORD_NOT_FOUND)) throw categoryNotFound(id);
      // ON DELETE RESTRICT: PostgreSQL refuses while transactions still reference the category.
      if (hasPrismaCode(error, FOREIGN_KEY_VIOLATION)) {
        throw new ConflictException(
          'Category is used by one or more transactions and cannot be deleted',
        );
      }
      throw error;
    }
  }
}

function categoryNotFound(id: string): NotFoundException {
  return new NotFoundException(`Category ${id} not found`);
}
