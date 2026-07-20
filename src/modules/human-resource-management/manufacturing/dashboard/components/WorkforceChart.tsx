"use client";

import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { ChartDataPoint } from "../types";

interface WorkforceChartProps {
    data: ChartDataPoint[];
}

export function WorkforceChart({ data }: WorkforceChartProps) {
    if (!data || data.length === 0) {
        return (
            <div className="h-[400px] w-full rounded-xl border bg-card flex items-center justify-center">
                <p className="text-muted-foreground font-medium">No workforce data available.</p>
            </div>
        );
    }

    return (
        <div className="h-[400px] w-full rounded-xl border bg-card p-6 shadow-sm">
            <h3 className="font-bold text-lg mb-6">Workforce Attendance Over Time</h3>
            <ResponsiveContainer width="100%" height="85%">
                <ComposedChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                        <linearGradient id="workerGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.9}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis 
                        dataKey="date" 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: "#6b7280" }}
                        dy={10}
                    />
                    <YAxis 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: "#6b7280" }}
                    />
                    <Tooltip 
                        contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)", backgroundColor: "rgba(255, 255, 255, 0.95)" }}
                        cursor={{ fill: "#f3f4f6" }}
                    />
                    <Legend wrapperStyle={{ paddingTop: "20px" }} />
                    <Bar dataKey="actualWorkers" name="Actual Workers" fill="url(#workerGradient)" radius={[6, 6, 0, 0]} maxBarSize={60} />
                    <Line type="monotone" dataKey="targetWorkers" name="Set Workers" stroke="#8b5cf6" strokeWidth={3} strokeDasharray="5 5" dot={{ r: 4, fill: "#8b5cf6", strokeWidth: 2, stroke: "#fff" }} activeDot={{ r: 6 }} />
                </ComposedChart>
            </ResponsiveContainer>
        </div>
    );
}
