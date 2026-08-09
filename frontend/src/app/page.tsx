"use client";

import { useState, useEffect } from "react";
import Navigation from "../components/Navigation";
import Button from "../components/ui/Button";
import { PenIcon, ChartIcon, BookIcon, UserIcon, ArrowRightIcon } from "../components/ui/icons";
import { API_BASE_URL } from "../config/api";

const features = [
  {
    href: "/essay",
    title: "申论智能批改",
    desc: "AI 专家级批改，四维度评分体系，渐进式反馈，让每一次练习都有价值。",
    icon: PenIcon,
  },
  {
    href: "/assessment",
    title: "能力测评",
    desc: "基于真题题库的六维能力诊断，识别优势与短板，个性化学习路径推荐。",
    icon: ChartIcon,
  },
  {
    href: "/practice",
    title: "题库练习",
    desc: "135 道公考真题，6 大题型完整覆盖，智能推题匹配，系统性提升解题能力。",
    icon: BookIcon,
  },
  {
    href: "/profile",
    title: "学习档案",
    desc: "个人进步追踪、学习数据分析、成长轨迹可视化，见证每一次提升。",
    icon: UserIcon,
  },
];

const steps = [
  { step: "01", title: "能力测评", desc: "AI 诊断六维能力，识别优劣势" },
  { step: "02", title: "智能练习", desc: "个性化推题，针对性训练" },
  { step: "03", title: "专业批改", desc: "渐进式 AI 批改，四维评分" },
  { step: "04", title: "进步追踪", desc: "可视化成长，持续优化" },
];

export default function HomePage() {
  const [realStats, setRealStats] = useState({
    totalQuestions: 0,
    totalExtractions: 0,
    loading: true,
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/v1/questions/stats`);
        if (response.ok) {
          const data = await response.json();
          setRealStats({
            totalQuestions: data.total_questions || 0,
            totalExtractions: data.total_extractions || 0,
            loading: false,
          });
        }
      } catch (error) {
        console.log("获取统计数据失败:", error);
        setRealStats({
          totalQuestions: 135,
          totalExtractions: 1,
          loading: false,
        });
      }
    };

    fetchStats();
  }, []);

  return (
    <div className="min-h-screen bg-canvas pb-16 lg:pb-0 lg:pl-60">
      <Navigation />

      {/* Hero */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pt-16 md:pt-24 pb-12 text-center">
        <h1 className="font-serif text-3xl md:text-5xl font-semibold text-ink tracking-tight leading-snug">
          让每一次申论练习
          <br className="sm:hidden" />
          都更有价值
        </h1>
        <p className="mt-5 text-base md:text-lg text-ink-secondary max-w-xl mx-auto leading-relaxed">
          智考公考伴侣提供 AI 驱动的申论智能批改、能力测评与精选题库，
          陪伴您的公考之路。
        </p>

        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Button href="/essay" size="lg">
            开始申论批改
            <ArrowRightIcon className="w-4 h-4" />
          </Button>
          <Button href="/assessment" size="lg" variant="secondary">
            能力测评
          </Button>
        </div>

        {!realStats.loading && (
          <div className="mt-12 flex items-center justify-center gap-10 md:gap-14">
            <div className="text-center">
              <div className="font-serif text-3xl md:text-4xl font-semibold text-ink">
                {realStats.totalQuestions}
              </div>
              <div className="mt-1 text-sm text-ink-secondary">精选题目</div>
            </div>
            <div className="w-px h-10 bg-border" aria-hidden="true" />
            <div className="text-center">
              <div className="font-serif text-3xl md:text-4xl font-semibold text-ink">6</div>
              <div className="mt-1 text-sm text-ink-secondary">题型分类</div>
            </div>
          </div>
        )}
      </section>

      {/* Features */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pb-16">
        <div className="border-t border-border">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <a
                key={feature.href}
                href={feature.href}
                className="group flex items-start gap-4 py-6 border-b border-border transition-colors hover:bg-surface-muted/60 px-3 rounded-lg"
              >
                <div className="w-10 h-10 rounded-lg bg-surface-muted border border-border flex items-center justify-center flex-shrink-0 group-hover:border-accent/40 transition-colors">
                  <Icon className="w-5 h-5 text-ink" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="font-serif text-lg font-semibold text-ink group-hover:text-accent transition-colors">
                    {feature.title}
                  </h2>
                  <p className="mt-1.5 text-sm text-ink-secondary leading-relaxed">
                    {feature.desc}
                  </p>
                </div>
                <ArrowRightIcon className="w-5 h-5 text-ink-tertiary mt-2 flex-shrink-0 transition-transform duration-200 group-hover:translate-x-1 group-hover:text-accent" />
              </a>
            );
          })}
        </div>
      </section>

      {/* Learning flow */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pb-20">
        <h2 className="font-serif text-xl font-semibold text-ink mb-6">学习流程</h2>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {steps.map((step) => (
            <div
              key={step.step}
              className="rounded-xl border border-border bg-surface p-5"
            >
              <div className="font-serif text-sm text-accent font-semibold">
                {step.step}
              </div>
              <h3 className="mt-2 font-medium text-ink">{step.title}</h3>
              <p className="mt-1 text-sm text-ink-secondary leading-relaxed">
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-accent flex items-center justify-center">
              <span className="text-white font-serif font-bold text-xs">智</span>
            </div>
            <span className="text-sm text-ink-secondary">智考公考伴侣</span>
          </div>
          <p className="text-xs text-ink-tertiary">
            © 2024 智考公考伴侣 · 专业 · 智能 · 高效
          </p>
        </div>
      </footer>
    </div>
  );
}
