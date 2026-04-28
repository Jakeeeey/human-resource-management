"use client";

import React, { useMemo } from "react";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { 
} from "@/components/ui/chart";
import { 
  PieChart, 
  Pie, 
  Cell, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer
} from "recharts";
import { User, Department } from "../types";
import { differenceInYears, parseISO, isValid } from "date-fns";
import dynamic from "next/dynamic";

// Dynamic import for Leaflet map to avoid SSR issues
const EmployeeLocationMap = dynamic<{ employees: User[] }>(
  () => import("./EmployeeLocationMap"),
  { 
    ssr: false,
    loading: () => (
      <div className="h-[400px] w-full bg-muted animate-pulse rounded-xl flex items-center justify-center">
        <p className="text-muted-foreground font-medium">Loading Map Registry...</p>
      </div>
    )
  }
);

interface EmployeeInfographicsProps {
  employees: User[];
  departments: Department[];
}

export function EmployeeInfographics({ employees, departments }: EmployeeInfographicsProps) {
  // 1. Data Transformation: Gender
  const genderData = useMemo(() => {
    const counts: Record<string, number> = {};
    employees.forEach(emp => {
      const gender = emp.gender || "Not Specified";
      counts[gender] = (counts[gender] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [employees]);

  // 2. Data Transformation: Department
  const deptData = useMemo(() => {
    const counts: Record<string, number> = {};
    const deptMap = new Map(departments.map(d => [String(d.department_id), d.department_name]));
    
    employees.forEach(emp => {
      const deptId = emp.department ? String(emp.department) : "Unassigned";
      const deptName = deptMap.get(deptId) || deptId;
      counts[deptName] = (counts[deptName] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [employees, departments]);

  // 3. Data Transformation: Age Groups
  const ageData = useMemo(() => {
    const groups = [
      { name: "18-25", min: 18, max: 25, value: 0 },
      { name: "26-35", min: 26, max: 35, value: 0 },
      { name: "36-45", min: 36, max: 45, value: 0 },
      { name: "46-55", min: 46, max: 55, value: 0 },
      { name: "56+", min: 56, max: 120, value: 0 },
    ];

    employees.forEach(emp => {
      if (emp.birthday) {
        const date = parseISO(emp.birthday);
        if (isValid(date)) {
          const age = differenceInYears(new Date(), date);
          const group = groups.find(g => age >= g.min && age <= g.max);
          if (group) group.value++;
        }
      }
    });

    return groups;
  }, [employees]);

  // 4. Data Transformation: Religion
  const religionData = useMemo(() => {
    const counts: Record<string, number> = {};
    employees.forEach(emp => {
      const religion = emp.religion || "Not Specified";
      counts[religion] = (counts[religion] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5); // Top 5
  }, [employees]);

  // 5. Data Transformation: Nationality
  const nationalityData = useMemo(() => {
    const counts: Record<string, number> = {};
    employees.forEach(emp => {
      const nationality = emp.nationality || "Not Specified";
      counts[nationality] = (counts[nationality] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [employees]);

  // 6. Data Transformation: Civil Status
  const civilStatusData = useMemo(() => {
    const counts: Record<string, number> = {};
    employees.forEach(emp => {
      const status = emp.civilStatus || "Not Specified";
      counts[status] = (counts[status] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [employees]);

  // Chart Colors
  const COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'];

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      {/* Map Section */}
      <Card className="border-none shadow-lg overflow-hidden rounded-3xl">
        <CardHeader className="bg-muted/30 pb-4">
          <CardTitle className="text-xl font-bold">Geographic Distribution</CardTitle>
          <CardDescription>Employee residential mapping across regions</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <EmployeeLocationMap employees={employees} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Gender Breakdown */}
        <Card className="border-none shadow-md rounded-3xl">
          <CardHeader>
            <CardTitle className="text-lg font-bold">Gender Diversity</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={genderData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {genderData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Age Groups */}
        <Card className="border-none shadow-md rounded-3xl">
          <CardHeader>
            <CardTitle className="text-lg font-bold">Age Demographics</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ageData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Civil Status */}
        <Card className="border-none shadow-md rounded-3xl">
          <CardHeader>
            <CardTitle className="text-lg font-bold">Civil Status</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={civilStatusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={10}
                  outerRadius={80}
                  dataKey="value"
                  label={({ name }) => name}
                >
                  {civilStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Religions */}
        <Card className="border-none shadow-md rounded-3xl">
          <CardHeader>
            <CardTitle className="text-lg font-bold">Religious Affiliation</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={religionData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={100} fontSize={12} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Bar dataKey="value" fill="#ec4899" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Nationalities */}
        <Card className="border-none shadow-md rounded-3xl">
          <CardHeader>
            <CardTitle className="text-lg font-bold">Nationality Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={nationalityData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={100} fontSize={12} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Bar dataKey="value" fill="#10b981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Workforce Distribution */}
        <Card className="col-span-1 border-none shadow-md rounded-3xl">
          <CardHeader>
            <CardTitle className="text-lg font-bold">Workforce Growth (Dummy)</CardTitle>
            <CardDescription>Simulated quarterly hiring trend</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] flex items-center justify-center italic text-muted-foreground text-sm">
            Hiring trends visualization module ready for connection...
          </CardContent>
        </Card>

        {/* Department Distribution */}
        <Card className="col-span-1 md:col-span-2 lg:col-span-3 border-none shadow-md rounded-3xl">
          <CardHeader>
            <CardTitle className="text-lg font-bold">Workforce Distribution by Department</CardTitle>
          </CardHeader>
          <CardContent className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={deptData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Bar dataKey="value" fill="#f59e0b" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
