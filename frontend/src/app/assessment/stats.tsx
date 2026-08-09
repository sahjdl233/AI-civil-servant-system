"use client";

import { useState, useEffect } from 'react';
import { API_BASE_URL } from '../../config/api';

interface TypeInfo {
  type: string;
  available_questions: number;
  selected_per_assessment: number;
  sufficient: boolean;
}

interface AssessmentTypesData {
  total_questions_in_db: number;
  total_questions_per_assessment: number;
  assessment_config: TypeInfo[];
}

export default function AssessmentStats() {
  const [data, setData] = useState<AssessmentTypesData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/v1/assessment/types`);
        if (response.ok) {
          const result = await response.json();
          setData(result.data);
        }
      } catch (error) {
        console.error('获取测评统计信息失败:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="bg-surface border border-border rounded-xl p-6 mb-8 animate-pulse">
        <div className="h-6 bg-surface-muted rounded mb-4"></div>
        <div className="space-y-3">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="h-4 bg-surface-muted rounded w-3/4"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="bg-surface border border-border rounded-xl p-6 mb-8">
      <h2 className="font-serif text-xl font-semibold text-ink mb-6">题库配置详情</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-accent-soft rounded-xl p-4 text-center">
          <div className="text-3xl font-bold font-serif text-accent mb-2">{data.total_questions_in_db}</div>
          <div className="text-ink-secondary text-sm">题库总题数</div>
        </div>
        <div className="bg-surface-muted rounded-xl p-4 text-center">
          <div className="text-3xl font-bold font-serif text-ink mb-2">{data.total_questions_per_assessment}</div>
          <div className="text-ink-secondary text-sm">每次测评题数</div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-base font-medium text-ink mb-3">各题型配置</h3>
        {data.assessment_config.map((config, index) => (
          <div key={index} className={`border rounded-lg p-4 ${
            config.sufficient ? 'border-success/30 bg-success/5' : 'border-warning/30 bg-warning/5'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <span className="font-medium text-ink">{config.type}</span>
                <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${
                  config.sufficient ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
                }`}>
                  {config.sufficient ? '充足' : '不足'}
                </span>
              </div>
              <div className="text-sm text-ink-secondary">
                可用: {config.available_questions} | 选用: {config.selected_per_assessment}
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-6 p-4 bg-surface-muted rounded-lg flex items-start gap-2.5">
        <svg className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v5M12 16h.01" />
        </svg>
        <p className="text-sm text-ink-secondary leading-relaxed">
          测评系统会从每个题型中随机选取3道题目，确保全面评估各项能力。
          题目基于真实考试题库，保证测评的专业性和准确性。
        </p>
      </div>
    </div>
  );
}
