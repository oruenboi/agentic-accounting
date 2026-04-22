import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class HealthService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getStatus(): Promise<{ status: string; database: string }> {
    await this.databaseService.query('select 1');

    return {
      status: 'ok',
      database: 'ok'
    };
  }
}

