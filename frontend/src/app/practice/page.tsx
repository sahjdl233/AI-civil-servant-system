"use client";

import { useState, useEffect } from 'react';
import Navigation from '../../components/Navigation';
import { API_BASE_URL } from '../../config/api';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import {
  ArrowRightIcon,
  BookIcon,
  ChartIcon,
  FileTextIcon,
  SparkleIcon,
} from '../../components/ui/icons';

// 题型识别和图标映射函数
const getTypeInfo = (typeName: string): { icon: string; color: string; displayName: string } => {
  const typeStr = typeName.toLowerCase();
  
  if (typeStr.includes('政治理论') || typeStr.includes('一、政治')) {
    return { 
      icon: "🏛️", 
      color: "from-red-500 to-pink-600",
      displayName: "政治理论"
    };
  }
  
  if (typeStr.includes('常识判断') || typeStr.includes('二、常识')) {
    return { 
      icon: "🧠", 
      color: "from-blue-500 to-indigo-600",
      displayName: "常识判断"
    };
  }
  
  if (typeStr.includes('言语理解') || typeStr.includes('三、言语')) {
    return { 
      icon: "📝", 
      color: "from-green-500 to-emerald-600",
      displayName: "言语理解与表达"
    };
  }
  
  if (typeStr.includes('数量关系') || typeStr.includes('四、数量')) {
    return { 
      icon: "🔢", 
      color: "from-yellow-500 to-orange-600",
      displayName: "数量关系"
    };
  }
  
  if (typeStr.includes('判断推理') || typeStr.includes('五、判断')) {
    return { 
      icon: "🎯", 
      color: "from-purple-500 to-indigo-600",
      displayName: "判断推理"
    };
  }
  
  if (typeStr.includes('资料分析') || typeStr.includes('六、资料')) {
    return { 
      icon: "📊", 
      color: "from-cyan-500 to-blue-600",
      displayName: "资料分析"
    };
  }
  
  if (typeStr.includes('行测')) {
    return { 
      icon: "📋", 
      color: "from-indigo-500 to-purple-600",
      displayName: "行测"
    };
  }
  
  if (typeStr.includes('申论')) {
    return { 
      icon: "✍️", 
      color: "from-orange-500 to-red-600",
      displayName: "申论"
    };
  }
  
  // 默认未知类型
  return { 
    icon: "❓", 
    color: "from-gray-400 to-gray-600",
    displayName: typeName.length > 20 ? typeName.substring(0, 20) + "..." : typeName
  };
};

interface QuestionStats {
  total_questions: number;
  total_extractions: number;
  type_distribution: Array<{ type: string; count: number }>;
}

export default function PracticePage() {
  const [questionStats, setQuestionStats] = useState<QuestionStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/v1/questions/stats`);
        if (response.ok) {
          const data = await response.json();
          setQuestionStats(data);
        }
      } catch (error) {
        console.log('获取题库统计失败:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchStats();
  }, []);

  // 开始分类练习
  const startCategoryPractice = (categoryType: string) => {
    try {
      // 保存练习配置
      const practiceConfig = {
        mode: 'category',
        categoryType: categoryType,
        timestamp: new Date().toISOString()
      };
      
      localStorage.setItem('practice_config', JSON.stringify(practiceConfig));
      
      // 跳转到练习页面
      window.location.href = '/practice/session';
    } catch (error) {
      console.error('启动分类练习失败:', error);
      alert('启动练习失败，请稍后重试');
    }
  };

  // 开始智能推荐练习
  const startSmartPractice = () => {
    try {
      // 检查是否有测评数据
      let assessmentData = null;
      
      // 检查专用练习数据
      let stored = localStorage.getItem('assessment_result_for_practice');
      if (stored) {
        const data = JSON.parse(stored);
        const dataAge = new Date().getTime() - new Date(data.timestamp).getTime();
        if (dataAge < 24 * 60 * 60 * 1000) { // 24小时内有效
          assessmentData = data.result;
        }
      }
      
      // 如果没有专用数据，检查通用测评结果
      if (!assessmentData) {
        const latestResult = localStorage.getItem('latest_assessment_result');
        if (latestResult) {
          const resultData = JSON.parse(latestResult);
          assessmentData = resultData;
          
          // 保存为练习专用数据
          const practiceData = {
            result: resultData,
            timestamp: new Date().toISOString()
          };
          localStorage.setItem('assessment_result_for_practice', JSON.stringify(practiceData));
        }
      }
      
      if (!assessmentData) {
        alert('请先完成能力测评，获得智能推荐！\n\n点击下方"📊 能力测评"按钮完成测评。');
        return;
      }
      
      const practiceConfig = {
        mode: 'smart',
        assessmentResult: assessmentData,
        timestamp: new Date().toISOString()
      };
      
      localStorage.setItem('practice_config', JSON.stringify(practiceConfig));
      window.location.href = '/practice/session';
    } catch (error) {
      console.error('启动智能练习失败:', error);
      alert('启动练习失败，请稍后重试');
    }
  };

  // 开始模拟考试
  const startMockExam = () => {
    try {
      const practiceConfig = {
        mode: 'mock_exam',
        timeLimit: 120, // 120分钟
        questionCount: 18, // 18道题
        timestamp: new Date().toISOString()
      };
      
      localStorage.setItem('practice_config', JSON.stringify(practiceConfig));
      window.location.href = '/practice/session';
    } catch (error) {
      console.error('启动模拟考试失败:', error);
      alert('启动考试失败，请稍后重试');
    }
  };

  return (
    <div className="min-h-screen bg-canvas pb-16 lg:pb-0 lg:pl-60">
      <Navigation />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <PageHeader
          title="题库练习系统"
          description={loading ? "加载中..." : questionStats ? `${questionStats.total_questions}道精选真题，全面覆盖公考各个题型` : "精选真题，全面覆盖公考各个题型"}
        />

        {/* 总体统计 */}
        <Card className="p-6 mb-10">
          {loading ? (
            <div className="grid grid-cols-3 gap-6 text-center animate-pulse">
              <div>
                <div className="h-8 bg-surface-muted rounded mb-2"></div>
                <div className="text-ink-secondary">总题数</div>
              </div>
              <div>
                <div className="h-8 bg-surface-muted rounded mb-2"></div>
                <div className="text-ink-secondary">题型分类</div>
              </div>
              <div>
                <div className="h-8 bg-surface-muted rounded mb-2"></div>
                <div className="text-ink-secondary">文档提取</div>
              </div>
            </div>
          ) : questionStats ? (
            <div className="grid grid-cols-3 gap-6 text-center">
              <div>
                <div className="text-3xl font-serif font-bold text-accent mb-1">{questionStats.total_questions}</div>
                <div className="text-ink-secondary">总题数</div>
              </div>
              <div>
                <div className="text-3xl font-serif font-bold text-accent mb-1">{questionStats.type_distribution?.length || 0}</div>
                <div className="text-ink-secondary">题型分类</div>
              </div>
              <div>
                <div className="text-3xl font-serif font-bold text-accent mb-1">{questionStats.total_extractions}</div>
                <div className="text-ink-secondary">文档提取</div>
              </div>
            </div>
          ) : (
            <div className="text-center text-ink-secondary">加载统计数据失败</div>
          )}
        </Card>

        {/* 题型分类卡片 */}
        <div id="category-section" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
          {loading ? (
            Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="animate-pulse">
                <div className="bg-surface border border-border rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-14 h-14 bg-surface-muted rounded-xl"></div>
                    <div className="text-right">
                      <div className="h-8 bg-surface-muted rounded w-12 mb-1"></div>
                      <div className="h-4 bg-surface-muted rounded w-16"></div>
                    </div>
                  </div>
                  <div className="h-5 bg-surface-muted rounded w-20 mb-2"></div>
                  <div className="h-4 bg-surface-muted rounded w-32 mb-4"></div>
                  <div className="flex items-center justify-between">
                    <div className="h-3 bg-surface-muted rounded w-16"></div>
                    <div className="w-5 h-5 bg-surface-muted rounded"></div>
                  </div>
                </div>
              </div>
            ))
          ) : questionStats?.type_distribution ? (
            questionStats.type_distribution.map((category, index) => {
              const typeInfo = getTypeInfo(category.type);
              return (
                <div key={index} className="group cursor-pointer" onClick={() => startCategoryPractice(category.type)}>
                  <div className="bg-surface border border-border rounded-xl p-6 h-full hover:bg-surface-muted transition-colors duration-200">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-14 h-14 rounded-xl bg-surface-muted border border-border flex items-center justify-center text-2xl">
                        {typeInfo.icon}
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-serif font-bold text-ink">{category.count}</div>
                        <div className="text-sm text-ink-secondary">道题目</div>
                      </div>
                    </div>

                    <h3 className="text-lg font-serif font-semibold text-ink mb-2">{typeInfo.displayName}</h3>
                    <p className="text-ink-secondary text-sm mb-4">
                      来自真实题库，覆盖考试重点
                    </p>

                    <div className="flex items-center justify-between">
                      <span className="text-xs text-ink-tertiary">点击开始练习</span>
                      <ArrowRightIcon className="w-5 h-5 text-ink-tertiary group-hover:text-accent transition-colors" />
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="col-span-full text-center py-12">
              <div className="text-ink-secondary">暂无题型数据</div>
            </div>
          )}
        </div>

        {/* 练习模式选择 */}
        <h2 className="text-xl font-serif font-semibold text-ink mb-6 text-center">选择练习模式</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
          <div
            onClick={startSmartPractice}
            className="text-center p-6 rounded-xl border border-border bg-surface hover:bg-surface-muted transition-colors cursor-pointer group"
          >
            <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-accent-soft text-accent flex items-center justify-center">
              <SparkleIcon className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-serif font-semibold text-ink mb-3">智能练习</h3>
            <p className="text-ink-secondary text-sm mb-4">
              基于测评结果，AI推荐最适合的题目
            </p>
            <Badge className="bg-accent-soft text-accent">智能推荐</Badge>
          </div>

          <div
            onClick={() => {
              const categorySection = document.getElementById('category-section');
              if (categorySection) {
                categorySection.scrollIntoView({ behavior: 'smooth' });
              }
            }}
            className="text-center p-6 rounded-xl border border-border bg-surface hover:bg-surface-muted transition-colors cursor-pointer group"
          >
            <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-surface-muted text-ink-secondary flex items-center justify-center">
              <BookIcon className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-serif font-semibold text-ink mb-3">分类练习</h3>
            <p className="text-ink-secondary text-sm mb-4">
              按题型分类练习，针对性提升专项能力
            </p>
            <Badge>经典模式</Badge>
          </div>

          <div
            onClick={startMockExam}
            className="text-center p-6 rounded-xl border border-border bg-surface hover:bg-surface-muted transition-colors cursor-pointer group"
          >
            <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-warning/10 text-warning flex items-center justify-center">
              <FileTextIcon className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-serif font-semibold text-ink mb-3">模拟考试</h3>
            <p className="text-ink-secondary text-sm mb-4">
              限时模拟考试环境，检验真实水平
            </p>
            <Badge className="bg-warning/10 text-warning">挑战模式</Badge>
          </div>
        </div>

        {/* 快速入口 */}
        <div className="text-center">
          <h3 className="text-xl font-serif font-semibold text-ink mb-6">快速入口</h3>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button href="/assessment" size="lg">
              <ChartIcon className="w-4 h-4" />
              能力测评
            </Button>
            <Button variant="secondary" size="lg" href="/api/v1/questions/admin/dashboard" target="_blank">
              题库管理后台
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
