import React, { useState, useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CronBuilderProps {
  value: string;
  onChange: (value: string) => void;
}

const presets: { label: string; value: string }[] = [
  { label: "每分钟", value: "* * * * *" },
  { label: "每小时", value: "0 * * * *" },
  { label: "每天零点", value: "0 0 * * *" },
  { label: "每天早上9点", value: "0 9 * * *" },
  { label: "每周一早上9点", value: "0 9 * * 1" },
  { label: "每月1号零点", value: "0 0 1 * *" },
];

const weekDays = [
  { label: "周日", value: "0" },
  { label: "周一", value: "1" },
  { label: "周二", value: "2" },
  { label: "周三", value: "3" },
  { label: "周四", value: "4" },
  { label: "周五", value: "5" },
  { label: "周六", value: "6" },
];

function parseCron(expr: string): { minute: string; hour: string; day: string; month: string; weekday: string } {
  const parts = expr.split(/\s+/);
  return {
    minute: parts[0] || "*",
    hour: parts[1] || "*",
    day: parts[2] || "*",
    month: parts[3] || "*",
    weekday: parts[4] || "*",
  };
}

function describeCron(expr: string): string {
  const { minute, hour, day, month, weekday } = parseCron(expr);

  if (expr === "* * * * *") return "每分钟执行一次";
  if (expr === "0 * * * *") return "每小时整点执行";
  if (expr === "0 0 * * *") return "每天零点执行";
  if (minute === "0" && hour !== "*" && day === "*" && month === "*" && weekday === "*") {
    return `每天 ${hour}:00 执行`;
  }
  if (minute === "0" && hour !== "*" && day === "*" && month === "*" && weekday !== "*") {
    const dayLabel = weekDays.find((d) => d.value === weekday)?.label || weekday;
    return `每${dayLabel} ${hour}:00 执行`;
  }
  if (minute === "0" && hour === "0" && day !== "*" && month === "*") {
    return `每月 ${day} 日零点执行`;
  }

  const parts: string[] = [];
  if (minute !== "*") parts.push(`第 ${minute} 分钟`);
  if (hour !== "*") parts.push(`${hour} 时`);
  if (day !== "*") parts.push(`${day} 日`);
  if (month !== "*") parts.push(`${month} 月`);
  if (weekday !== "*") {
    const dayLabel = weekDays.find((d) => d.value === weekday)?.label || weekday;
    parts.push(dayLabel);
  }

  return parts.length > 0 ? parts.join("，") : "自定义表达式";
}

function getNextExecutions(expr: string, count: number = 5): string[] {
  // Simplified next execution time calculation
  const now = new Date();
  const results: string[] = [];
  const { minute, hour } = parseCron(expr);

  const base = new Date(now);
  base.setSeconds(0);
  base.setMilliseconds(0);

  if (minute !== "*") {
    base.setMinutes(parseInt(minute, 10));
  }
  if (hour !== "*") {
    base.setHours(parseInt(hour, 10));
  }

  if (base <= now) {
    if (hour === "*") {
      base.setHours(base.getHours() + 1);
    } else {
      base.setDate(base.getDate() + 1);
    }
  }

  for (let i = 0; i < count; i++) {
    const next = new Date(base);
    if (hour === "*" && minute === "*") {
      next.setMinutes(now.getMinutes() + i + 1);
    } else if (hour === "*") {
      next.setHours(now.getHours() + i);
    } else {
      next.setDate(base.getDate() + i);
    }
    results.push(
      next.toLocaleString("zh-CN", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    );
  }

  return results;
}

const CronBuilder: React.FC<CronBuilderProps> = ({ value, onChange }) => {
  const [mode, setMode] = useState<"preset" | "custom">(
    presets.some((p) => p.value === value) ? "preset" : "custom"
  );

  const parsed = useMemo(() => parseCron(value), [value]);
  const description = useMemo(() => describeCron(value), [value]);
  const nextExecutions = useMemo(() => getNextExecutions(value), [value]);

  const updatePart = (part: string, val: string) => {
    const current = parseCron(value);
    const updated = { ...current, [part]: val };
    onChange(`${updated.minute} ${updated.hour} ${updated.day} ${updated.month} ${updated.weekday}`);
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button
          type="button"
          variant={mode === "preset" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("preset")}
        >
          预设
        </Button>
        <Button
          type="button"
          variant={mode === "custom" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("custom")}
        >
          自定义
        </Button>
      </div>

      {mode === "preset" ? (
        <div className="grid grid-cols-2 gap-1.5">
          {presets.map((preset) => (
            <Button
              key={preset.value}
              type="button"
              variant={value === preset.value ? "default" : "outline"}
              size="sm"
              className="text-xs"
              onClick={() => onChange(preset.value)}
            >
              {preset.label}
            </Button>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-5 gap-2">
            <div>
              <Label className="text-[10px] text-muted-foreground">分钟</Label>
              <Input
                value={parsed.minute}
                onChange={(e) => updatePart("minute", e.target.value)}
                className="h-7 text-xs"
                placeholder="*"
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">小时</Label>
              <Input
                value={parsed.hour}
                onChange={(e) => updatePart("hour", e.target.value)}
                className="h-7 text-xs"
                placeholder="*"
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">日</Label>
              <Input
                value={parsed.day}
                onChange={(e) => updatePart("day", e.target.value)}
                className="h-7 text-xs"
                placeholder="*"
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">月</Label>
              <Input
                value={parsed.month}
                onChange={(e) => updatePart("month", e.target.value)}
                className="h-7 text-xs"
                placeholder="*"
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">星期</Label>
              <Select
                value={parsed.weekday}
                onValueChange={(v) => updatePart("weekday", v)}
              >
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue placeholder="*" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="*">每天</SelectItem>
                  {weekDays.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-md bg-muted/50 p-2">
        <div className="text-xs text-muted-foreground mb-1">表达式: <code className="text-foreground">{value}</code></div>
        <div className="text-xs font-medium text-primary">{description}</div>
      </div>

      <div>
        <Label className="text-[10px] text-muted-foreground mb-1 block">
          接下来 5 次执行时间
        </Label>
        <div className="space-y-0.5">
          {nextExecutions.map((time, i) => (
            <div key={i} className="text-[11px] text-muted-foreground">
              {i + 1}. {time}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CronBuilder;
