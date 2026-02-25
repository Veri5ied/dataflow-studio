export type PostgresCredentials = {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
};

export class PostgresConnector {
  constructor(private readonly credentials: PostgresCredentials) {}

  async testConnection() {
    return {
      ok: true,
      details: `Scaffold only: ${this.credentials.host}:${this.credentials.port}`
    };
  }
}
