// packages/payments/providers/anz.ts
import axios from "axios";
import { PayToService } from "../payto.js";

export class AnzPayToService implements PayToService {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = process.env.ANZ_API_URL ?? "https://api.anz.example.com";
    this.apiKey = process.env.ANZ_API_KEY ?? "demo-key";
  }

  async createMandate(accountNumber: string): Promise<string> {
    const res = await axios.post(
      `${this.baseUrl}/payto/mandates`,
      { accountNumber },
      {
        headers: { Authorization: `Bearer ${this.apiKey}` },
        timeout: 10000,
      },
    );
    return res.data.mandateId;
  }

  async verifyMandate(mandateId: string): Promise<boolean> {
    const res = await axios.get(
      `${this.baseUrl}/payto/mandates/${encodeURIComponent(mandateId)}`,
      {
        headers: { Authorization: `Bearer ${this.apiKey}` },
        timeout: 10000,
      },
    );
    return res.data.status === "ACTIVE";
  }
}
