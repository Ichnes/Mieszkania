import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Label,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type MortgageRow = {
  month: number;
  balance: number;
  annualRate: number;
  extra: number;
};

type MortgageResult = {
  rows: MortgageRow[];
  interest: number;
  totalPaid: number;
  basePayment: number;
};

export default function MortgageVisuals({
  principal,
  base,
  modified,
}: {
  principal: number;
  base: MortgageResult;
  modified: MortgageResult;
}) {
  const everyYear = Array.from(
    { length: Math.max(base.rows.length, modified.rows.length) },
    (_, index) => index,
  )
    .filter((index) => index === 0 || index % 12 === 11 || index === modified.rows.length - 1)
    .map((index) => ({
      month: index + 1,
      bazowy: base.rows[index]?.balance ?? 0,
      poNadplatach: modified.rows[index]?.balance ?? 0,
      oprocentowanie: modified.rows[index]?.annualRate ?? 0,
    }));
  const before = [
    { name: "Kapitał", value: principal, color: "#2e8472" },
    { name: "Odsetki", value: base.interest, color: "#e7a64a" },
  ];
  const after = [
    { name: "Kapitał", value: principal, color: "#2e8472" },
    { name: "Odsetki", value: modified.interest, color: "#e7a64a" },
    {
      name: "Nadpłaty",
      value: modified.rows.reduce((sum, row) => sum + row.extra, 0),
      color: "#637eeb",
    },
  ];

  return (
    <section className="premium-mortgage-visuals">
      <article className="panel premium-balance-chart">
        <div className="chart-heading">
          <div>
            <p className="eyebrow">Porównanie</p>
            <h3>Jak nadpłaty zmieniają saldo</h3>
          </div>
          <span>{Math.max(0, base.rows.length - modified.rows.length)} rat mniej</span>
        </div>
        <ResponsiveContainer width="100%" height={330}>
          <AreaChart data={everyYear} margin={{ top: 16, right: 18, left: 12, bottom: 4 }}>
            <defs>
              <linearGradient id="mortgageBase" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#e7a64a" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#e7a64a" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="mortgageExtra" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2e8472" stopOpacity={0.5} />
                <stop offset="100%" stopColor="#2e8472" stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#dce6e1" />
            <XAxis dataKey="month" tickFormatter={(value) => `${Math.ceil(value / 12)} r.`} />
            <YAxis tickFormatter={(value) => `${Math.round(value / 1000)}k`} />
            <Tooltip
              formatter={(value) => formatPln(Number(value))}
              labelFormatter={(value) => `Miesiąc ${value}`}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="bazowy"
              name="Bez nadpłat"
              stroke="#d9902f"
              fill="url(#mortgageBase)"
              strokeWidth={3}
            />
            <Area
              type="monotone"
              dataKey="poNadplatach"
              name="Po nadpłatach"
              stroke="#207863"
              fill="url(#mortgageExtra)"
              strokeWidth={4}
            />
          </AreaChart>
        </ResponsiveContainer>
      </article>
      <article className="panel premium-rate-chart">
        <div className="chart-heading">
          <div>
            <p className="eyebrow">Scenariusz stopy</p>
            <h3>Oprocentowanie w czasie</h3>
          </div>
          <span>płynna zmiana</span>
        </div>
        <ResponsiveContainer width="100%" height={330}>
          <LineChart data={everyYear} margin={{ top: 16, right: 18, left: 0, bottom: 4 }}>
            <CartesianGrid vertical={false} stroke="#dce6e1" />
            <XAxis dataKey="month" tickFormatter={(value) => `${Math.ceil(value / 12)} r.`} />
            <YAxis
              domain={["auto", "auto"]}
              tickFormatter={(value) => `${Number(value).toFixed(1)}%`}
            />
            <Tooltip
              formatter={(value) => `${Number(value).toFixed(2)}%`}
              labelFormatter={(value) => `Miesiąc ${value}`}
            />
            <Line
              type="monotone"
              dataKey="oprocentowanie"
              name="Oprocentowanie"
              stroke="#637eeb"
              strokeWidth={4}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </article>
      <article className="panel premium-cost-chart">
        <div className="chart-heading">
          <div>
            <p className="eyebrow">Struktura kosztów</p>
            <h3>Przed i po nadpłatach</h3>
          </div>
        </div>
        <div className="premium-donuts">
          <CostDonut title="Bez nadpłat" data={before} />
          <CostDonut title="Po nadpłatach" data={after} />
        </div>
      </article>
    </section>
  );
}

function CostDonut({
  title,
  data,
}: {
  title: string;
  data: Array<{ name: string; value: number; color: string }>;
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  return (
    <div className="cost-donut">
      <h4>{title}</h4>
      <div className="cost-donut-chart">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={60}
              outerRadius={88}
              paddingAngle={3}
              stroke="none"
            >
              {data.map((item) => (
                <Cell key={item.name} fill={item.color} />
              ))}
              <Label
                value={formatPln(total)}
                position="center"
                fill="#1e3130"
                fontSize={14}
                fontWeight={800}
              />
            </Pie>
            <Tooltip formatter={(value) => formatPln(Number(value))} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul>
        {data.map((item) => (
          <li key={item.name}>
            <i style={{ background: item.color }} />
            <span>{item.name}</span>
            <strong>{formatPln(item.value)}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatPln(value: number) {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    maximumFractionDigits: 0,
  }).format(value);
}
