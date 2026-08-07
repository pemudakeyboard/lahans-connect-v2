import { SetMetadata } from '@nestjs/common';

export const PERMISSION_KEY = 'requiredPermission';
export const DATA_SCOPE_KEY = 'dataScopeField';

/**
 * Declares the permission(s) required to invoke a handler.
 *
 * BRD 5.3 (3): "Setiap endpoint WAJIB dianotasi. Tanpa anotasi → deny by default."
 * The CI `permission-coverage` gate fails when a controller has no annotation.
 *
 * Example:
 *   @RequirePermission('leave.request.approve')
 *   @Post(':id/approve')
 */
export const RequirePermission = (...permissions: string[]): MethodDecorator =>
  SetMetadata(PERMISSION_KEY, permissions);

/**
 * Declares which entity field carries the data scope for this endpoint,
 * used by the DataScopeInterceptor to inject the scope filter.
 * Example: @ApplyDataScope('employee_id')
 */
export const ApplyDataScope = (field: string): MethodDecorator =>
  SetMetadata(DATA_SCOPE_KEY, field);
