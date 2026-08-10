"use client";

import { useState, useEffect, useCallback } from 'react';
import Navigation from '../../../components/Navigation';
import { API_BASE_URL } from '../../../config/api';
import Image from 'next/image';
import Card from '../../../components/ui/Card';
import Badge from '../../../components/ui/Badge';
import Button from '../../../components/ui/Button';
import { CheckIcon, LoaderIcon } from '../../../components/ui/icons';

// 练习配置接口
interface PracticeConfig {
  mode: 'category' | 'smart' | 'mock_exam';
  categoryType?: string;
  assessmentResult?: Record<string, unknown>;
  timeLimit?: number;
  questionCount?: number;
  timestamp: string;
}

// 题目接口
interface Question {
  id: number;
  question_number: number;
  title: string;
  content: string;
  options: { [key: string]: string }; // Dictionary format like {"A": "option1", "B": "option2"}
  correct_answer: string;
  explanation: string;
  question_type: string;
  images?: Array<{
    id: number;
    url: string;
    image_type: string;
    context_text?: string;
    paragraph_index?: number;
    position_in_question?: string;
  }>;
}

// 练习结果接口
interface PracticeResult {
  totalQuestions: number;
  correctAnswers: number;
  wrongAnswers: number;
  accuracy: number;
  timeSpent: number;
  detailedResults: Array<{
    question: Question;
    userAnswer: string;
    correct: boolean;
    timeSpent: number;
  }>;
}

export default function PracticeSessionPage() {
  // 状态管理
  const [config, setConfig] = useState<PracticeConfig | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<{ [key: number]: string }>({});
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<PracticeResult | null>(null);
  const [timeSpent, setTimeSpent] = useState(0);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [questionStartTime, setQuestionStartTime] = useState<Date | null>(null);
  const [questionTimes, setQuestionTimes] = useState<{ [key: number]: number }>({});

  // 初始化练习
  useEffect(() => {
    const initializePractice = async () => {
      try {
        // 检查是否在客户端环境
        if (typeof window === 'undefined') return;
        
        // 获取练习配置
        const savedConfig = localStorage.getItem('practice_config');
        if (!savedConfig) {
          alert('练习配置丢失，返回练习选择页面');
          window.location.href = '/practice';
          return;
        }

        const practiceConfig: PracticeConfig = JSON.parse(savedConfig);
        setConfig(practiceConfig);
        setStartTime(new Date());
        setQuestionStartTime(new Date());

        // 根据模式获取题目
        let questionsData: Question[] = [];
        
        if (practiceConfig.mode === 'category') {
          // 分类练习模式
          questionsData = await fetchQuestionsByCategory(practiceConfig.categoryType!);
        } else if (practiceConfig.mode === 'smart') {
          // 智能推荐模式
          questionsData = await fetchPersonalizedQuestions(practiceConfig.assessmentResult);
        } else if (practiceConfig.mode === 'mock_exam') {
          // 模拟考试模式
          questionsData = await fetchMockExamQuestions(practiceConfig.questionCount || 18);
        }

        if (questionsData.length === 0) {
          alert('未找到合适的题目');
          if (typeof window !== 'undefined') {
            window.location.href = '/practice';
          }
          return;
        }

        setQuestions(questionsData);
      } catch (error) {
        console.error('初始化练习失败:', error);
        alert('初始化练习失败，请重试');
        if (typeof window !== 'undefined') {
          window.location.href = '/practice';
        }
      } finally {
        setLoading(false);
      }
    };

    initializePractice();
  }, []);

  // 计时器
  useEffect(() => {
    if (!loading && !submitted && startTime) {
      const timer = setInterval(() => {
        setTimeSpent(Math.floor((new Date().getTime() - startTime.getTime()) / 1000));
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [loading, submitted, startTime]);

  // 根据题型获取题目
  const fetchQuestionsByCategory = async (categoryType: string): Promise<Question[]> => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/practice/category`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category_type: categoryType, limit: 20 })
      });

      if (response.ok) {
        const data = await response.json();
        return data.questions || [];
      }
      return [];
    } catch (error) {
      console.error('获取分类题目失败:', error);
      return [];
    }
  };

  // 获取个性化推荐题目
  const fetchPersonalizedQuestions = async (assessmentResult?: Record<string, unknown>): Promise<Question[]> => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/practice/personalized`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assessment_result: assessmentResult })
      });

      if (response.ok) {
        const data = await response.json();
        return data.data?.questions || [];
      }
      return [];
    } catch (error) {
      console.error('获取个性化题目失败:', error);
      return [];
    }
  };

  // 获取模拟考试题目
  const fetchMockExamQuestions = async (questionCount: number): Promise<Question[]> => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/practice/mock-exam`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question_count: questionCount })
      });

      if (response.ok) {
        const data = await response.json();
        return data.questions || [];
      }
      return [];
    } catch (error) {
      console.error('获取模拟考试题目失败:', error);
      return [];
    }
  };

  // 选择答案
  const selectAnswer = (answer: string) => {
    // 记录当前题目的答题时间
    if (questionStartTime) {
      const timeSpentOnQuestion = Math.floor((new Date().getTime() - questionStartTime.getTime()) / 1000);
      setQuestionTimes(prev => ({
        ...prev,
        [currentQuestionIndex]: timeSpentOnQuestion
      }));
    }

    setUserAnswers(prev => ({
      ...prev,
      [currentQuestionIndex]: answer
    }));
  };

  // 下一题
  const nextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setQuestionStartTime(new Date());
    }
  };

  // 上一题
  const previousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
      setQuestionStartTime(new Date());
    }
  };

  // 跳转到指定题目
  const goToQuestion = (index: number) => {
    setCurrentQuestionIndex(index);
    setQuestionStartTime(new Date());
  };

  // 提交练习
  const submitPractice = () => {
    if (Object.keys(userAnswers).length < questions.length) {
      const unanswered = questions.length - Object.keys(userAnswers).length;
      if (!confirm(`还有${unanswered}道题未作答，确认提交吗？`)) {
        return;
      }
    }

    // 计算结果
    let correctCount = 0;
    const detailedResults = questions.map((question, index) => {
      const userAnswer = userAnswers[index] || '';
      const correct = userAnswer === question.correct_answer;
      if (correct) correctCount++;

      return {
        question,
        userAnswer,
        correct,
        timeSpent: questionTimes[index] || 0
      };
    });

    const practiceResult: PracticeResult = {
      totalQuestions: questions.length,
      correctAnswers: correctCount,
      wrongAnswers: questions.length - correctCount,
      accuracy: Math.round((correctCount / questions.length) * 100),
      timeSpent,
      detailedResults
    };

    setResult(practiceResult);
    setSubmitted(true);

    // 清除练习配置
    if (typeof window !== 'undefined') {
      localStorage.removeItem('practice_config');
    }
  };

  // 重新开始
  const restart = () => {
    if (typeof window !== 'undefined') {
      window.location.href = '/practice';
    }
  };

  // 格式化时间
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 获取当前题目
  const currentQuestion = questions[currentQuestionIndex];

  if (loading) {
    return (
      <div className="min-h-screen bg-canvas pb-16 lg:pb-0 lg:pl-60">
        <Navigation />
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <LoaderIcon className="animate-spin w-10 h-10 text-accent mx-auto mb-4" />
            <h2 className="text-lg font-medium text-ink">正在准备题目...</h2>
          </div>
        </div>
      </div>
    );
  }

  // 结果页面
  if (submitted && result) {
    return (
      <div className="min-h-screen bg-canvas pb-16 lg:pb-0 lg:pl-60">
        <Navigation />

        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
          {/* 练习完成标题 */}
          <div className="text-center mb-10">
            <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-success/10 text-success flex items-center justify-center">
              <CheckIcon className="w-8 h-8" />
            </div>

            <h1 className="font-serif text-3xl font-semibold text-ink mb-3">
              练习完成！
            </h1>
            <p className="text-ink-secondary">
              {config?.mode === 'category' && '分类练习'}
              {config?.mode === 'smart' && '智能推荐练习'}
              {config?.mode === 'mock_exam' && '模拟考试'}
              结果统计
            </p>
          </div>

          {/* 成绩概览 */}
          <Card className="p-6 sm:p-8 mb-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-center">
              <div>
                <div className="text-3xl font-serif font-bold text-accent mb-2">{result.accuracy}%</div>
                <div className="text-ink-secondary">准确率</div>
              </div>
              <div>
                <div className="text-3xl font-serif font-bold text-success mb-2">{result.correctAnswers}</div>
                <div className="text-ink-secondary">正确题数</div>
              </div>
              <div>
                <div className="text-3xl font-serif font-bold text-danger mb-2">{result.wrongAnswers}</div>
                <div className="text-ink-secondary">错误题数</div>
              </div>
              <div>
                <div className="text-3xl font-serif font-bold text-ink mb-2">{formatTime(result.timeSpent)}</div>
                <div className="text-ink-secondary">用时</div>
              </div>
            </div>
          </Card>

          {/* 操作按钮 */}
          <div className="text-center space-y-4">
            <div className="flex justify-center gap-4 flex-wrap">
              <Button onClick={restart} size="lg">
                返回练习中心
              </Button>
              <Button
                variant="secondary"
                size="lg"
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    window.location.href = '/assessment';
                  }
                }}
              >
                能力测评
              </Button>
            </div>

            <p className="text-sm text-ink-tertiary">
              练习记录已保存，继续加油！
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas pb-16 lg:pb-0 lg:pl-60">
      <Navigation />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {/* 答题头部信息 */}
        <div className="bg-surface border border-border rounded-xl px-5 py-4 mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <h1 className="text-lg font-serif font-semibold text-ink">
              {config?.mode === 'category' && `分类练习 - ${config.categoryType}`}
              {config?.mode === 'smart' && 'AI智能推荐练习'}
              {config?.mode === 'mock_exam' && '模拟考试'}
            </h1>
            <div className="text-sm text-ink-secondary">
              第 {currentQuestionIndex + 1} / {questions.length} 题
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-sm text-ink-secondary">
              用时: {formatTime(timeSpent)}
            </div>
            <Button onClick={submitPractice}>
              提交练习
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* 题目导航 */}
          <div className="lg:col-span-1">
            <Card className="p-5 lg:sticky lg:top-8">
              <h3 className="text-base font-serif font-semibold text-ink mb-4">题目导航</h3>
              <div className="grid grid-cols-6 gap-2">
                {questions.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => goToQuestion(index)}
                    className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors duration-200 ${
                      index === currentQuestionIndex
                        ? 'bg-accent text-white'
                        : userAnswers[index]
                        ? 'bg-accent-soft text-accent hover:bg-accent/20'
                        : 'bg-surface-muted text-ink-secondary hover:bg-border'
                    }`}
                  >
                    {index + 1}
                  </button>
                ))}
              </div>

              <div className="mt-6 space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-accent rounded"></div>
                  <span className="text-ink-secondary">当前题目</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-accent-soft border border-accent/30 rounded"></div>
                  <span className="text-ink-secondary">已作答</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-surface-muted border border-border rounded"></div>
                  <span className="text-ink-secondary">未作答</span>
                </div>
              </div>
            </Card>
          </div>

          {/* 题目内容 */}
          <div className="lg:col-span-3">
            {!currentQuestion || !currentQuestion.options ? (
              <Card className="p-8">
                <div className="text-center">
                  <div className="text-ink-secondary mb-4">题目数据加载中...</div>
                  <div className="animate-pulse bg-surface-muted h-4 rounded w-3/4 mx-auto mb-2"></div>
                  <div className="animate-pulse bg-surface-muted h-4 rounded w-1/2 mx-auto"></div>
                </div>
              </Card>
            ) : (
              <Card className="p-6 sm:p-8">
                {/* 题目标题 */}
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-serif font-semibold text-ink">
                    第 {currentQuestionIndex + 1} 题
                  </h2>
                  <Badge>{currentQuestion.question_type}</Badge>
                </div>

                {/* 题目内容 */}
                <div className="mb-8">
                  <div className="text-ink text-lg leading-relaxed whitespace-pre-wrap">
                    {currentQuestion.content}
                  </div>

                  {/* 题目图片 */}
                  {currentQuestion.images && currentQuestion.images.length > 0 && (
                    <div className="mt-6 space-y-4">
                      {currentQuestion.images.map((image, index) => (
                        <div key={index} className="relative">
                          <Image
                            src={image.url}
                            alt={`题目图片 ${index + 1}`}
                            width={600}
                            height={400}
                            className="rounded-lg border border-border max-w-full h-auto"
                            style={{ objectFit: 'contain' }}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 选项 */}
                <div className="space-y-3 mb-8">
                  {currentQuestion.options && Object.entries(currentQuestion.options).map(([optionLabel, optionText]) => {
                    const isSelected = userAnswers[currentQuestionIndex] === optionLabel;

                    return (
                      <button
                        key={optionLabel}
                        onClick={() => selectAnswer(optionLabel)}
                        className={`w-full text-left p-4 rounded-lg border transition-colors duration-200 ${
                          isSelected
                            ? 'border-accent bg-accent-soft text-ink'
                            : 'border-border bg-surface hover:border-ink-tertiary hover:bg-surface-muted'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium ${
                            isSelected ? 'bg-accent text-white' : 'bg-surface-muted text-ink-secondary border border-border'
                          }`}>
                            {optionLabel}
                          </span>
                          <span className="text-ink">{optionText}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* 导航按钮 */}
                <div className="flex justify-between items-center">
                  <button
                    onClick={previousQuestion}
                    disabled={currentQuestionIndex === 0}
                    className="flex items-center gap-2 px-6 py-3 bg-surface-muted hover:bg-border disabled:bg-surface disabled:text-ink-tertiary text-ink rounded-lg transition-colors duration-200 disabled:cursor-not-allowed"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    上一题
                  </button>

                  <div className="text-sm text-ink-secondary">
                    {Object.keys(userAnswers).length} / {questions.length} 已完成
                  </div>

                  <button
                    onClick={nextQuestion}
                    disabled={currentQuestionIndex === questions.length - 1}
                    className="flex items-center gap-2 px-6 py-3 bg-accent hover:bg-accent-hover disabled:bg-surface-muted disabled:text-ink-tertiary text-white rounded-lg transition-colors duration-200 disabled:cursor-not-allowed"
                  >
                    下一题
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
