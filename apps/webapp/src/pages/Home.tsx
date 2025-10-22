import { ArrowUpRight, LineChartIcon } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";

const metrics = [
  {
    title: "Active mandates",
    value: "24",
    change: "+3.4% vs last week",
    description:
      "Structured credit and private equity deals currently tracked in the Pro+ workspace."
  },
  {
    title: "Total committed capital",
    value: "$4.8B",
    change: "+$180M new commitments",
    description: "Aggregate bank and fund lines allocated across open portfolios."
  },
  {
    title: "Average utilization",
    value: "67%",
    change: "-5.3% risk exposure",
    description: "Weighted utilization across all active bank lines for the current quarter."
  }
];

const activities = [
  {
    name: "GreenRidge solar expansion",
    detail: "Closing diligence with Commonwealth Bank",
    status: "Due tomorrow"
  },
  {
    name: "Helios storage facility",
    detail: "Amended terms shared with syndicate partners",
    status: "Updated 2h ago"
  },
  {
    name: "Urban mobility fund II",
    detail: "Capital call scheduled for Monday",
    status: "Action needed"
  }
];

const trendData = [
  { week: "May 6", utilization: 59, commitments: 38 },
  { week: "May 13", utilization: 62, commitments: 44 },
  { week: "May 20", utilization: 64, commitments: 49 },
  { week: "May 27", utilization: 63, commitments: 46 },
  { week: "Jun 3", utilization: 65, commitments: 50 },
  { week: "Jun 10", utilization: 67, commitments: 53 },
  { week: "Jun 17", utilization: 66, commitments: 55 }
];

export default function HomePage() {
  return (
    <div className="grid gap-10">
      <header className="grid gap-3">
        <Badge variant="secondary" className="w-fit">
          Portfolio pulse
        </Badge>
        <h1 className="text-4xl tracking-tight">Instant signal on capital deployment</h1>
        <p className="max-w-2xl text-base text-muted">
          Monitor capital utilization, track live mandates, and surface emerging risk signals
          across your institutional banking relationships.
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card className="h-full">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-xl">
                <LineChartIcon className="h-5 w-5" aria-hidden="true" />
                Utilization momentum
              </CardTitle>
              <CardDescription>
                Weekly trend of aggregate bank line utilization versus new commitments.
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" className="gap-1 text-muted" asChild>
              <a href="#">
                Export data
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </a>
            </Button>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ left: 0, right: 0, top: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="utilization" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="commitments" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-success)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--color-success)" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="6 6" stroke="var(--color-border)" />
                <XAxis dataKey="week" stroke="var(--color-text-muted)" tickLine={false} axisLine={false} />
                <YAxis
                  stroke="var(--color-text-muted)"
                  tickLine={false}
                  axisLine={false}
                  width={40}
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip
                  cursor={{ stroke: "var(--color-primary)", strokeWidth: 1 }}
                  contentStyle={{
                    backgroundColor: "var(--color-surface)",
                    borderRadius: "var(--radius-md)",
                    border: `1px solid var(--color-border)`,
                    color: "var(--color-text)"
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="utilization"
                  stroke="var(--color-primary)"
                  fill="url(#utilization)"
                  strokeWidth={2}
                  dot={{ strokeWidth: 2, r: 3 }}
                />
                <Area
                  type="monotone"
                  dataKey="commitments"
                  stroke="var(--color-success)"
                  fill="url(#commitments)"
                  strokeWidth={2}
                  dot={{ strokeWidth: 2, r: 3 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Workflow alerts</CardTitle>
            <CardDescription>Curated tasks across deal teams and syndicate partners.</CardDescription>
          </CardHeader>
          <CardContent className="gap-4">
            <ul className="grid gap-4">
              {activities.map((activity) => (
                <li key={activity.name} className="flex flex-col gap-2 rounded-md border border-border/70 p-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-wide text-muted">
                      {activity.status}
                    </p>
                    <p className="text-lg font-semibold leading-tight">{activity.name}</p>
                  </div>
                  <p className="text-sm text-muted">{activity.detail}</p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>

      <section aria-label="Key metrics" className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {metrics.map((metric) => (
          <Card key={metric.title} className="shadow-sm">
            <CardHeader className="space-y-1">
              <CardTitle className="text-3xl tracking-tight">{metric.value}</CardTitle>
              <CardDescription>{metric.title}</CardDescription>
            </CardHeader>
            <CardContent className="gap-3">
              <Badge variant="outline" className="w-fit text-xs">
                {metric.change}
              </Badge>
              <p className="text-sm text-muted">{metric.description}</p>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
