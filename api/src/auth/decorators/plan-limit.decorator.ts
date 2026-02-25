import { SetMetadata } from '@nestjs/common';

export const PLAN_LIMIT_KEY = 'plan_limit';
export const PlanLimit = (resource: 'users' | 'maps' | 'layers') => SetMetadata(PLAN_LIMIT_KEY, resource);