export type SupportedEngine = "postgresql" | "mysql" | "sqlite" | "sqlserver";

export type DemoTable = {
  rows: number;
  cols: string[];
};

export type DemoDatabase = {
  name: string;
  engine: SupportedEngine;
  tables: Record<string, DemoTable>;
};

export type QueryResult = {
  cols: string[];
  rows: Array<Array<string | number | null>>;
};

export const demoDbs = {
  ecommerce: {
    name: "ecommerce_demo",
    engine: "postgresql",
    tables: {
      users: {
        rows: 14820,
        cols: ["id", "email", "name", "country", "tier", "created_at"],
      },
      orders: {
        rows: 38291,
        cols: [
          "id",
          "user_id",
          "status",
          "total_cents",
          "created_at",
          "shipped_at",
        ],
      },
      products: {
        rows: 1204,
        cols: ["id", "sku", "name", "category", "price_cents", "stock"],
      },
      order_items: {
        rows: 91043,
        cols: ["id", "order_id", "product_id", "qty", "unit_price_cents"],
      },
      payments: {
        rows: 38010,
        cols: ["id", "order_id", "method", "status", "amount_cents", "paid_at"],
      },
      reviews: {
        rows: 6820,
        cols: ["id", "user_id", "product_id", "rating", "body", "created_at"],
      },
    },
  },
  analytics: {
    name: "analytics_demo",
    engine: "postgresql",
    tables: {
      events: {
        rows: 482091,
        cols: [
          "id",
          "session_id",
          "user_id",
          "name",
          "properties",
          "timestamp",
        ],
      },
      sessions: {
        rows: 28310,
        cols: [
          "id",
          "user_id",
          "device",
          "browser",
          "country",
          "started_at",
          "ended_at",
        ],
      },
      pageviews: {
        rows: 194820,
        cols: [
          "id",
          "session_id",
          "url",
          "referrer",
          "duration_ms",
          "timestamp",
        ],
      },
      goals: {
        rows: 9204,
        cols: ["id", "user_id", "name", "achieved_at", "value"],
      },
      funnels: {
        rows: 84,
        cols: ["id", "name", "steps", "created_at"],
      },
    },
  },
  saas: {
    name: "saas_demo",
    engine: "mysql",
    tables: {
      workspaces: {
        rows: 342,
        cols: ["id", "name", "plan", "seat_limit", "created_at"],
      },
      users: {
        rows: 2840,
        cols: ["id", "email", "name", "role", "created_at"],
      },
      memberships: {
        rows: 3120,
        cols: ["id", "workspace_id", "user_id", "role", "joined_at"],
      },
      subscriptions: {
        rows: 298,
        cols: [
          "id",
          "workspace_id",
          "plan",
          "status",
          "seats",
          "current_period_end",
        ],
      },
      invoices: {
        rows: 1840,
        cols: [
          "id",
          "workspace_id",
          "amount_cents",
          "status",
          "due_at",
          "paid_at",
        ],
      },
      usage_events: {
        rows: 94820,
        cols: ["id", "workspace_id", "user_id", "event", "value", "ts"],
      },
    },
  },
} satisfies Record<string, DemoDatabase>;

export type DemoDatabaseKey = keyof typeof demoDbs;

export const mockResults: Record<string, QueryResult> = {
  "SELECT * FROM users LIMIT 10;": {
    cols: ["id", "email", "name", "country", "tier", "created_at"],
    rows: [
      ["usr_001", "ada@example.com", "Ada Okonkwo", "NG", "gold", "2025-11-02"],
      [
        "usr_002",
        "kofi@example.com",
        "Kofi Mensah",
        "GH",
        "silver",
        "2025-11-14",
      ],
      [
        "usr_003",
        "fatima@example.com",
        "Fatima Diallo",
        "SN",
        "bronze",
        "2025-12-01",
      ],
      [
        "usr_004",
        "zainab@example.com",
        "Zainab Musa",
        "NG",
        "gold",
        "2025-12-18",
      ],
      [
        "usr_005",
        "emeka@example.com",
        "Emeka Obi",
        "NG",
        "silver",
        "2026-01-03",
      ],
      [
        "usr_006",
        "amara@example.com",
        "Amara Toure",
        "CI",
        "bronze",
        "2026-01-20",
      ],
      [
        "usr_007",
        "kwame@example.com",
        "Kwame Asante",
        "GH",
        "gold",
        "2026-02-05",
      ],
      [
        "usr_008",
        "nadia@example.com",
        "Nadia Benali",
        "MA",
        "bronze",
        "2026-02-18",
      ],
      [
        "usr_009",
        "seun@example.com",
        "Seun Adeyemi",
        "NG",
        "silver",
        "2026-03-01",
      ],
      [
        "usr_010",
        "lily@example.com",
        "Lily Osei",
        "GH",
        "bronze",
        "2026-03-04",
      ],
    ],
  },
  "SELECT * FROM orders LIMIT 10;": {
    cols: ["id", "user_id", "status", "total_cents", "created_at"],
    rows: [
      ["ord_8841", "usr_001", "delivered", 24999, "2026-02-10"],
      ["ord_8842", "usr_003", "shipped", 8500, "2026-02-11"],
      ["ord_8843", "usr_002", "pending", 45000, "2026-02-12"],
      ["ord_8844", "usr_007", "delivered", 12000, "2026-02-13"],
      ["ord_8845", "usr_004", "cancelled", 3200, "2026-02-14"],
      ["ord_8846", "usr_009", "delivered", 67800, "2026-02-15"],
      ["ord_8847", "usr_001", "shipped", 9100, "2026-02-16"],
      ["ord_8848", "usr_005", "pending", 14500, "2026-02-17"],
      ["ord_8849", "usr_010", "delivered", 28000, "2026-02-18"],
      ["ord_8850", "usr_006", "shipped", 5600, "2026-02-19"],
    ],
  },
  "SELECT * FROM products LIMIT 10;": {
    cols: ["id", "sku", "name", "category", "price_cents", "stock"],
    rows: [
      ["prd_001", "SKU-A1", "Wireless Headphones", "Electronics", 12999, 342],
      ["prd_002", "SKU-A2", "Mechanical Keyboard", "Electronics", 8500, 89],
      ["prd_003", "SKU-B1", "Desk Lamp", "Home", 3499, 210],
      ["prd_004", "SKU-B2", "Ergonomic Chair", "Home", 45000, 34],
      ["prd_005", "SKU-C1", "Running Shoes", "Apparel", 8900, 156],
      ["prd_006", "SKU-C2", "Yoga Mat", "Sports", 2800, 420],
      ["prd_007", "SKU-D1", "Coffee Maker", "Kitchen", 15000, 67],
      ["prd_008", "SKU-D2", "Water Bottle", "Kitchen", 1200, 890],
      ["prd_009", "SKU-E1", "Notebook A5", "Stationery", 599, 1200],
      ["prd_010", "SKU-E2", "Fountain Pen", "Stationery", 4200, 78],
    ],
  },
  "SELECT * FROM events LIMIT 10;": {
    cols: ["id", "session_id", "user_id", "name", "timestamp"],
    rows: [
      ["evt_001", "ses_a1", "usr_001", "page_view", "2026-03-05 08:00:01"],
      ["evt_002", "ses_a1", "usr_001", "button_click", "2026-03-05 08:00:14"],
      ["evt_003", "ses_a1", "usr_001", "checkout_start", "2026-03-05 08:01:02"],
      ["evt_004", "ses_a2", "usr_003", "page_view", "2026-03-05 08:02:30"],
      ["evt_005", "ses_a2", "usr_003", "search", "2026-03-05 08:02:45"],
      ["evt_006", "ses_a3", "usr_007", "signup", "2026-03-05 08:04:00"],
      ["evt_007", "ses_a3", "usr_007", "page_view", "2026-03-05 08:04:05"],
      [
        "evt_008",
        "ses_a4",
        "usr_002",
        "checkout_complete",
        "2026-03-05 08:05:12",
      ],
      ["evt_009", "ses_a5", "usr_004", "page_view", "2026-03-05 08:06:44"],
      ["evt_010", "ses_a5", "usr_004", "button_click", "2026-03-05 08:07:01"],
    ],
  },
  "SELECT * FROM sessions LIMIT 10;": {
    cols: ["id", "user_id", "device", "browser", "country", "started_at"],
    rows: [
      ["ses_a1", "usr_001", "mobile", "Chrome", "NG", "2026-03-05 08:00:00"],
      ["ses_a2", "usr_003", "desktop", "Firefox", "SN", "2026-03-05 08:02:28"],
      ["ses_a3", "usr_007", "desktop", "Chrome", "GH", "2026-03-05 08:03:58"],
      ["ses_a4", "usr_002", "tablet", "Safari", "GH", "2026-03-05 08:05:00"],
      ["ses_a5", "usr_004", "mobile", "Chrome", "NG", "2026-03-05 08:06:40"],
      ["ses_a6", "usr_010", "desktop", "Edge", "GH", "2026-03-05 08:10:00"],
      ["ses_a7", "usr_009", "mobile", "Chrome", "NG", "2026-03-05 08:15:11"],
      ["ses_a8", "usr_005", "desktop", "Chrome", "NG", "2026-03-05 08:20:04"],
      ["ses_a9", "usr_006", "mobile", "Safari", "CI", "2026-03-05 08:22:30"],
      ["ses_a10", "usr_008", "desktop", "Firefox", "MA", "2026-03-05 08:25:00"],
    ],
  },
  "SELECT * FROM workspaces LIMIT 10;": {
    cols: ["id", "name", "plan", "seat_limit", "created_at"],
    rows: [
      ["ws_001", "Acme Corp", "pro", 25, "2025-10-01"],
      ["ws_002", "Startup Hub", "trial", 5, "2025-11-14"],
      ["ws_003", "Dev Team", "community", null, "2025-12-01"],
      ["ws_004", "Big Enterprise", "enterprise", 100, "2026-01-08"],
      ["ws_005", "Freelance Studio", "community", null, "2026-01-20"],
      ["ws_006", "Data Wranglers", "pro", 10, "2026-02-03"],
      ["ws_007", "Analytics Co", "pro", 15, "2026-02-15"],
      ["ws_008", "Solo Project", "community", null, "2026-02-28"],
      ["ws_009", "Growth Team", "trial", 5, "2026-03-01"],
      ["ws_010", "Platform Eng", "enterprise", 50, "2026-03-04"],
    ],
  },
  "SELECT * FROM subscriptions LIMIT 10;": {
    cols: [
      "id",
      "workspace_id",
      "plan",
      "status",
      "seats",
      "current_period_end",
    ],
    rows: [
      ["sub_001", "ws_001", "pro", "active", 8, "2026-04-01"],
      ["sub_002", "ws_002", "trial", "trialing", 2, "2026-03-19"],
      ["sub_004", "ws_004", "enterprise", "active", 34, "2027-01-08"],
      ["sub_006", "ws_006", "pro", "active", 6, "2026-03-03"],
      ["sub_007", "ws_007", "pro", "active", 9, "2026-03-15"],
      ["sub_009", "ws_009", "trial", "trialing", 3, "2026-03-15"],
      ["sub_010", "ws_010", "enterprise", "active", 22, "2027-03-04"],
    ],
  },
};

export const aiQueries: Record<
  DemoDatabaseKey,
  { sql: string; result: QueryResult }
> = {
  ecommerce: {
    sql: `-- AI generated: Top 5 customers by total spend (last 30 days)
SELECT
  u.id,
  u.name,
  u.email,
  COUNT(o.id)                 AS order_count,
  SUM(o.total_cents) / 100.0  AS total_spent_usd
FROM users u
JOIN orders o ON o.user_id = u.id
WHERE o.status = 'delivered'
  AND o.created_at > NOW() - INTERVAL '30 days'
GROUP BY u.id, u.name, u.email
ORDER BY total_spent_usd DESC
LIMIT 5;`,
    result: {
      cols: ["id", "name", "email", "order_count", "total_spent_usd"],
      rows: [
        ["usr_001", "Ada Okonkwo", "ada@example.com", 8, 1284.9],
        ["usr_007", "Kwame Asante", "kwame@example.com", 5, 940],
        ["usr_004", "Zainab Musa", "zainab@example.com", 6, 812.5],
        ["usr_009", "Seun Adeyemi", "seun@example.com", 4, 721.3],
        ["usr_002", "Kofi Mensah", "kofi@example.com", 3, 680],
      ],
    },
  },
  analytics: {
    sql: `-- AI generated: Daily active users last 7 days
SELECT
  DATE(timestamp)           AS day,
  COUNT(DISTINCT user_id)   AS dau
FROM events
WHERE timestamp > NOW() - INTERVAL '7 days'
GROUP BY day
ORDER BY day DESC;`,
    result: {
      cols: ["day", "dau"],
      rows: [
        ["2026-03-05", 842],
        ["2026-03-04", 791],
        ["2026-03-03", 814],
        ["2026-03-02", 768],
        ["2026-03-01", 912],
        ["2026-02-28", 745],
        ["2026-02-27", 703],
      ],
    },
  },
  saas: {
    sql: `-- AI generated: Monthly recurring revenue by plan
SELECT
  plan,
  COUNT(*)     AS workspaces,
  SUM(seats)   AS total_seats,
  SUM(seats) * CASE plan
    WHEN 'enterprise' THEN 8000
    WHEN 'pro'        THEN 1500
    ELSE 0
  END / 100.0  AS mrr_usd
FROM subscriptions
WHERE status IN ('active','trialing')
GROUP BY plan
ORDER BY mrr_usd DESC;`,
    result: {
      cols: ["plan", "workspaces", "total_seats", "mrr_usd"],
      rows: [
        ["enterprise", 2, 56, 4480],
        ["pro", 3, 23, 345],
        ["trial", 2, 5, 0],
      ],
    },
  },
};

const sampleValues = {
  email: [
    "ada@ex.com",
    "kofi@ex.com",
    "fatima@ex.com",
    "zainab@ex.com",
    "kwame@ex.com",
  ],
  name: [
    "Ada Okonkwo",
    "Kofi Mensah",
    "Fatima Diallo",
    "Zainab Musa",
    "Kwame Asante",
  ],
  status: ["active", "pending", "delivered", "cancelled", "shipped"],
  plan: ["free", "pro", "enterprise", "trial"],
  country: ["NG", "GH", "SN", "CI", "MA", "ZA"],
  role: ["owner", "member", "viewer", "admin"],
  device: ["mobile", "desktop", "tablet"],
  browser: ["Chrome", "Firefox", "Safari", "Edge"],
  event: ["page_view", "click", "signup", "purchase"],
};

function randomItem(items: string[]) {
  return items[Math.floor(Math.random() * items.length)];
}

export function buildGeneratedRows(columns: string[], count: number) {
  return Array.from({ length: count }, () =>
    columns.map((column) => {
      if (column.includes("id")) {
        return `row_${Math.floor(Math.random() * 9999)
          .toString()
          .padStart(4, "0")}`;
      }
      if (column.includes("email")) {
        return randomItem(sampleValues.email);
      }
      if (column.includes("name")) {
        return randomItem(sampleValues.name);
      }
      if (column.includes("status")) {
        return randomItem(sampleValues.status);
      }
      if (column.includes("plan")) {
        return randomItem(sampleValues.plan);
      }
      if (column.includes("country")) {
        return randomItem(sampleValues.country);
      }
      if (column.includes("role")) {
        return randomItem(sampleValues.role);
      }
      if (column.includes("device")) {
        return randomItem(sampleValues.device);
      }
      if (column.includes("browser")) {
        return randomItem(sampleValues.browser);
      }
      if (column.includes("event")) {
        return randomItem(sampleValues.event);
      }
      if (column.includes("created_at")) {
        return `2026-0${1 + Math.floor(Math.random() * 3)}-${String(1 + Math.floor(Math.random() * 28)).padStart(2, "0")}`;
      }
      if (column.includes("timestamp")) {
        return `2026-03-05 ${String(Math.floor(Math.random() * 24)).padStart(2, "0")}:${String(Math.floor(Math.random() * 60)).padStart(2, "0")}:00`;
      }
      return Math.floor(Math.random() * 50000);
    }),
  );
}

export function formatRowCount(rows: number) {
  if (rows < 0) {
    return "-";
  }
  return rows >= 1000 ? `${(rows / 1000).toFixed(0)}k` : String(rows);
}

export function normalizeSql(sql: string) {
  return sql.replace(/\s+/g, " ").trim();
}
