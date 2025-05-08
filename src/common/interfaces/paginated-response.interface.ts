/* eslint-disable prettier/prettier */
export interface PaginatedResponse<T> {
    data: T[];
    metadata: {
      totalItems: number;
      totalPages: number;
      currentPage: number;
      pageSize: number;
    };
  }