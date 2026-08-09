"use client";

import { useState, useEffect } from 'react';
import Navigation from '../../components/Navigation';
import { MiniRadarChart } from '../../components/RadarChart';
import Card from '../../components/ui/Card';
import ScoreBar from '../../components/ui/ScoreBar';
import Button from '../../components/ui/Button';
import {
  BookIcon,
  ChartIcon,
  CheckIcon,
  PenIcon,
  SparkleIcon,
  StarIcon,
  UserIcon,
} from '../../components/ui/icons';

interface AssessmentResult {
  session_id: string;
  total_score: number;
  dimension_scores: { [key: string]: number };
  completed_at: string;
}

// 维度名称映射
const dimensionNames: { [key: string]: { name: string; icon: string; color: string } } = {
  comprehension: { name: '理解能力', icon: '🧠', color: 'text-blue-600' },
  analysis: { name: '分析能力', icon: '🔍', color: 'text-green-600' },
  expression: { name: '表达能力', icon: '✍️', color: 'text-purple-600' },
  logic: { name: '逻辑推理', icon: '🎯', color: 'text-orange-600' },
  application: { name: '应用能力', icon: '⚡', color: 'text-red-600' },
  innovation: { name: '创新思维', icon: '💡', color: 'text-yellow-600' }
};

interface LearningRecord {
  id: string;
  type: 'essay' | 'assessment';
  title: string;
  score: number;
  date: string;
  details?: any;
}

export default function ProfilePage() {
  const [assessmentResult, setAssessmentResult] = useState<AssessmentResult | null>(null);
  const [learningRecords, setLearningRecords] = useState<LearningRecord[]>([]);

  useEffect(() => {
    // 检查是否在客户端环境
    if (typeof window === 'undefined') return;

    // 尝试从localStorage获取最新的测评结果
    try {
      const stored = localStorage.getItem('latest_assessment_result');
      if (stored) {
        const result = JSON.parse(stored);
        setAssessmentResult(result);
      }
    } catch (error) {
      console.log('无法获取测评结果:', error);
    }

    // 获取学习记录
    loadLearningRecords();
  }, []);

  const loadLearningRecords = () => {
    try {
      // 从localStorage获取申论练习记录
      const essayRecords: LearningRecord[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('essay_result_')) {
          const data = JSON.parse(localStorage.getItem(key) || '{}');
          essayRecords.push({
            id: key,
            type: 'essay',
            title: `申论练习 - ${data.questionType || '综合题'}`,
            score: data.score || 0,
            date: data.timestamp || new Date().toISOString(),
            details: data
          });
        }
      }

      // 从localStorage获取测评记录
      const assessmentRecords: LearningRecord[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('assessment_result_')) {
          const data = JSON.parse(localStorage.getItem(key) || '{}');
          assessmentRecords.push({
            id: key,
            type: 'assessment',
            title: '能力测评',
            score: data.total_score || 0,
            date: data.completed_at || new Date().toISOString(),
            details: data
          });
        }
      }

      // 合并并按时间排序
      const allRecords = [...essayRecords, ...assessmentRecords]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 10); // 只显示最近10条记录

      setLearningRecords(allRecords);
    } catch (error) {
      console.log('无法获取学习记录:', error);
    }
  };
  return (
    <div className="min-h-screen bg-canvas pb-16 lg:pb-0 lg:pl-60">
      <Navigation />

      <div className="mx-auto max-w-6xl px-4 py-8">

        {/* 页面标题 */}
        <div className="text-center mb-10">
          <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-accent-soft flex items-center justify-center">
            <UserIcon className="w-8 h-8 text-accent" />
          </div>

          <h1 className="font-serif text-3xl font-semibold text-ink mb-3 tracking-tight">
            个人学习档案
          </h1>
          <p className="text-base text-ink-secondary">
            追踪学习进度，见证能力成长
          </p>
        </div>

        {/* 功能预览卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">

          {/* 能力雷达图 */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-serif text-lg font-semibold text-ink">能力雷达图</h3>
              <div className="w-9 h-9 bg-accent-soft text-accent rounded-lg flex items-center justify-center">
                <ChartIcon className="w-5 h-5" />
              </div>
            </div>

            {/* 模拟雷达图占位 */}
            <div className="relative w-28 h-28 mx-auto mb-4">
              <div className="w-full h-full border-2 border-dashed border-border rounded-full flex items-center justify-center">
                <ChartIcon className="w-10 h-10 text-ink-tertiary" />
              </div>
            </div>

            <p className="text-ink-secondary text-sm text-center">
              六维能力可视化展示，清晰了解个人优劣势
            </p>

            {/* 能力雷达图或提示信息 */}
            <div className="mt-4 text-center">
              {assessmentResult ? (
                <div>
                  <MiniRadarChart
                    data={assessmentResult.dimension_scores}
                    dimensions={dimensionNames}
                    size={180}
                    className="mx-auto mb-4"
                  />
                  <div className="text-center">
                    <div className="text-lg font-semibold text-ink mb-1">
                      综合评分：<span className="font-serif text-accent">{assessmentResult.total_score}</span>分
                    </div>
                    <div className="text-xs text-ink-tertiary">
                      测评时间：{new Date(assessmentResult.completed_at).toLocaleDateString()}
                    </div>
                    <Button
                      variant="ghost"
                      href="/assessment"
                      className="mt-2 text-sm"
                    >
                      重新测评
                      <SparkleIcon className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="mt-6 text-left space-y-3">
                    {Object.entries(assessmentResult.dimension_scores).map(([key, value]) => (
                      <div key={key} className="flex items-center gap-3">
                        <span className="w-20 text-left text-sm text-ink-secondary flex-shrink-0">
                          {dimensionNames[key]?.name || key}
                        </span>
                        <ScoreBar
                          value={Number(value)}
                          tone="accent"
                          className="h-2"
                        />
                        <span className="w-10 text-right font-serif text-sm font-medium text-ink flex-shrink-0">
                          {Number(value).toFixed(0)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-accent-soft border border-accent/20 rounded-lg p-5">
                  <ChartIcon className="w-10 h-10 text-accent mx-auto mb-3" />
                  <p className="text-ink font-medium mb-2">暂无能力数据</p>
                  <p className="text-ink-secondary text-sm">请先完成能力测评生成您的专属雷达图</p>
                  <Button href="/assessment" className="mt-3">
                    开始测评
                  </Button>
                </div>
              )}
            </div>
          </Card>

          {/* 学习统计 */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-serif text-lg font-semibold text-ink">学习统计</h3>
              <div className="w-9 h-9 bg-accent-soft text-accent rounded-lg flex items-center justify-center">
                <StarIcon className="w-5 h-5" />
              </div>
            </div>

            <div className="text-center">
              <div className="bg-surface-muted border border-border rounded-lg p-6">
                <ChartIcon className="w-12 h-12 text-ink-tertiary mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-ink mb-2">开始您的学习之旅</h3>
                <p className="text-ink-secondary text-sm mb-4">
                  完成申论练习后，这里将显示您的学习统计数据
                </p>
                <Button href="/essay" variant="primary">
                  开始申论练习
                </Button>
              </div>
            </div>
          </Card>

          {/* 学习计划 */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-serif text-lg font-semibold text-ink">学习计划</h3>
              <div className="w-9 h-9 bg-accent-soft text-accent rounded-lg flex items-center justify-center">
                <BookIcon className="w-5 h-5" />
              </div>
            </div>

            <div className="text-center">
              <div className="bg-accent-soft border border-accent/20 rounded-lg p-6">
                <BookIcon className="w-12 h-12 text-accent mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-ink mb-2">个性化学习计划</h3>
                <p className="text-ink-secondary text-sm mb-4">
                  完成能力测评后，系统将为您制定专属学习计划
                </p>
                <Button href="/assessment" variant="primary">
                  开始测评
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* 进步时间线 */}
        <Card className="p-6 md:p-8 mb-8">
          <h2 className="font-serif text-2xl font-semibold text-ink mb-6 text-center">学习进步时间线</h2>

          {learningRecords.length > 0 ? (
            <div className="space-y-5">
              {learningRecords.map((record, index) => (
                <div key={record.id} className="flex items-start gap-4">
                  {/* 时间线节点 */}
                  <div className="flex flex-col items-center">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      record.type === 'essay'
                        ? 'bg-accent-soft text-accent'
                        : 'bg-surface-muted text-ink-secondary border border-border'
                    }`}>
                      {record.type === 'essay' ? (
                        <PenIcon className="w-5 h-5" />
                      ) : (
                        <CheckIcon className="w-5 h-5" />
                      )}
                    </div>
                    {index < learningRecords.length - 1 && (
                      <div className="w-px h-12 bg-border mt-2"></div>
                    )}
                  </div>

                  {/* 记录内容 */}
                  <div className="flex-1 bg-surface-muted border border-border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-ink">{record.title}</h3>
                      <div className="flex items-center space-x-2">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          record.score >= 85 ? 'bg-success/10 text-success' :
                          record.score >= 70 ? 'bg-warning/10 text-warning' :
                          'bg-danger/10 text-danger'
                        }`}>
                          {record.score}分
                        </span>
                      </div>
                    </div>
                    <p className="text-ink-secondary text-sm">
                      {new Date(record.date).toLocaleString('zh-CN', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                    {record.type === 'essay' && record.details?.feedback && (
                      <p className="text-ink text-sm mt-2 line-clamp-2">
                        {record.details.feedback.substring(0, 100)}...
                      </p>
                    )}
                  </div>
                </div>
              ))}

              {/* 统计信息 */}
              <div className="mt-8 p-6 bg-surface-muted border border-border rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="font-serif text-3xl font-semibold text-accent">
                      {learningRecords.length}
                    </div>
                    <div className="text-ink-secondary text-sm">总练习次数</div>
                  </div>
                  <div>
                    <div className="font-serif text-3xl font-semibold text-success">
                      {Math.round(learningRecords.reduce((sum, r) => sum + r.score, 0) / learningRecords.length) || 0}
                    </div>
                    <div className="text-ink-secondary text-sm">平均分数</div>
                  </div>
                  <div>
                    <div className="font-serif text-3xl font-semibold text-warning">
                      {learningRecords.filter(r => r.score >= 80).length}
                    </div>
                    <div className="text-ink-secondary text-sm">优秀次数</div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-surface-muted flex items-center justify-center">
                <BookIcon className="w-10 h-10 text-ink-tertiary" />
              </div>
              <h3 className="text-xl font-semibold text-ink mb-3">您的学习历程即将开始</h3>
              <p className="text-ink-secondary mb-6">
                完成申论练习和能力测评后，这里将记录您的每一次进步
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button href="/assessment" variant="primary">
                  开始能力测评
                </Button>
                <Button href="/essay" variant="secondary">
                  申论练习
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* 行动建议 */}
        <div className="text-center">
          <h3 className="font-serif text-xl font-semibold text-ink mb-6">开始建立您的学习档案</h3>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button href="/assessment" variant="primary" size="lg">
              <SparkleIcon className="w-5 h-5" />
              完成能力测评
            </Button>
            <Button href="/" variant="secondary" size="lg">
              <PenIcon className="w-5 h-5" />
              开始申论练习
            </Button>
          </div>
          <p className="text-sm text-ink-tertiary mt-4">
            开始使用平台功能，建立您的专属学习档案
          </p>
        </div>
      </div>
    </div>
  );
}
