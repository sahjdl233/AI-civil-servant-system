"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import Navigation from '../../components/Navigation';
import { API_BASE_URL } from '../../config/api';
import RadarChart from '../../components/RadarChart';
import AssessmentStats from './stats';
import Button from '../../components/ui/Button';
import { ChartIcon, FileTextIcon, SparkleIcon, XIcon, CheckIcon, ArrowRightIcon } from '../../components/ui/icons';

interface Question {
  id: number;
  title: string;
  content: string;
  options: { [key: string]: string };
  correct_answer: string;
  question_type?: string;
  images?: Array<{
    id: string;
    url: string;
    image_type?: string;
    context_text?: string;
    paragraph_index?: number;
    position_in_question?: number;
  }>;
  ability_dimensions: { [key: string]: number };
  explanation: string;
}

interface AssessmentResult {
  session_id: string;
  total_score: number;
  dimension_scores: { [key: string]: number };
  detailed_scores: any[];
  recommendations: any[];
  completion_time: number;
  completed_at: string;
}

export default function AssessmentPage() {
  const [stage, setStage] = useState<'intro' | 'testing' | 'result'>('intro');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<{ [key: string]: string }>({});
  const [startTime, setStartTime] = useState<string>('');
  const [sessionId, setSessionId] = useState<string>('');
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [assessmentSummary, setAssessmentSummary] = useState<any>(null);
  const [lastSelectedAnswer, setLastSelectedAnswer] = useState<string>(''); // 记录上一题的选择

  const startAssessment = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/assessment/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        const data = await response.json();
        setSessionId(data.data.session_id);
        setStartTime(data.data.start_time);
        setQuestions(data.data.questions);
        setAssessmentSummary(data.data.assessment_summary);
        setStage('testing');
      }
    } catch (error) {
      console.error('启动测评失败:', error);
      alert('启动测评失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const submitAnswer = (questionId: string, answer: string) => {
    console.log('[DEBUG] 收集答案 - questionId:', questionId, 'answer:', answer);
    setAnswers(prev => {
      const newAnswers = { ...prev, [questionId]: answer };
      console.log('[DEBUG] 当前所有答案:', newAnswers);
      return newAnswers;
    });
    // 记录最后选择的答案，用于下一题的默认选项
    if (answer.trim()) {
      setLastSelectedAnswer(answer);
      console.log('[DEBUG] 记录最后选择的答案:', answer);
    }
  };

  const nextQuestion = () => {
    if (currentQuestion < questions.length - 1) {
      const nextIndex = currentQuestion + 1;
      const nextQuestionId = questions[nextIndex]?.id.toString();
      
      // 如果下一题还没有答案，且有上一题的选择记录，则自动设置默认答案
      if (nextQuestionId && !answers[nextQuestionId] && lastSelectedAnswer) {
        console.log('[DEBUG] 为下一题设置默认答案:', nextQuestionId, lastSelectedAnswer);
        setAnswers(prev => ({
          ...prev,
          [nextQuestionId]: lastSelectedAnswer
        }));
      }
      
      setCurrentQuestion(nextIndex);
    } else {
      submitAssessment();
    }
  };

  const submitAssessment = async () => {
    setLoading(true);
    try {
      // 确保所有题目都有答案记录（即使是空答案）
      const completeAnswers = { ...answers };
      questions.forEach(question => {
        const questionId = question.id.toString();
        if (!(questionId in completeAnswers)) {
          completeAnswers[questionId] = ''; // 为未回答的题目添加空答案
          console.log('[DEBUG] 为未答题目添加空答案:', questionId);
        }
      });
      
      console.log('[DEBUG] 提交的answers:', completeAnswers);
      console.log('[DEBUG] answers数量:', Object.keys(completeAnswers).length);
      console.log('[DEBUG] 题目总数:', questions.length);
      console.log('[DEBUG] 题目ID列表:', questions.map(q => q.id));
      
      const response = await fetch(`${API_BASE_URL}/api/v1/assessment/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          answers: completeAnswers,
          start_time: startTime
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('[DEBUG] 返回的详细答题数据:', data.data.detailed_scores);
        console.log('[DEBUG] detailed_scores数量:', data.data.detailed_scores?.length);
        setResult(data.data);
        
        // 保存测评结果到localStorage（两种格式都保存）
        try {
          // 保存通用格式
          localStorage.setItem('latest_assessment_result', JSON.stringify(data.data));
          
          // 同时保存到学习记录中，供学习进步时间线使用
          const recordId = `assessment_result_${Date.now()}`;
          const recordData = {
            ...data.data,
            timestamp: new Date().toISOString()
          };
          localStorage.setItem(recordId, JSON.stringify(recordData));
          console.log('测评记录已保存:', recordId);
          
          // 同时保存练习专用格式
          const practiceData = {
            result: data.data,
            timestamp: new Date().toISOString()
          };
          localStorage.setItem('assessment_result_for_practice', JSON.stringify(practiceData));
          
          console.log('测评结果已保存到localStorage (两种格式)');
        } catch (error) {
          console.log('保存测评结果失败:', error);
        }
        
        setStage('result');
      }
    } catch (error) {
      console.error('提交测评失败:', error);
      alert('提交测评失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const resetAssessment = () => {
    setStage('intro');
    setCurrentQuestion(0);
    setAnswers({});
    setResult(null);
    setSessionId('');
    setStartTime('');
    setLastSelectedAnswer(''); // 重置默认选项记录
  };

  if (stage === 'testing') {
    return <TestingInterface 
      questions={questions}
      currentQuestion={currentQuestion}
      answers={answers}
      onSubmitAnswer={submitAnswer}
      onNext={nextQuestion}
      loading={loading}
      lastSelectedAnswer={lastSelectedAnswer}
    />;
  }

  if (stage === 'result') {
    return <ResultInterface 
      result={result}
      onReset={resetAssessment}
    />;
  }
  return (
    <div className="min-h-screen bg-canvas pb-16 lg:pb-0 lg:pl-60">
      <Navigation />
      
      <div className="py-12 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="mb-8">
            <div className="w-32 h-32 mx-auto mb-6 rounded-full bg-accent-soft flex items-center justify-center">
              <svg className="w-16 h-16 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            
            <h1 className="text-3xl md:text-4xl font-serif font-semibold text-ink mb-4">
              能力测评系统
            </h1>
            <p className="text-base md:text-lg text-ink-secondary mb-8">
              AI智能诊断您的行测水平，每个题型深度测评，制定个性化学习方案
            </p>
          </div>

          {/* 功能介绍 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <div className="bg-surface border border-border rounded-xl p-6">
              <div className="w-10 h-10 rounded-lg bg-accent-soft text-accent flex items-center justify-center mb-4">
                <FileTextIcon className="w-5 h-5" />
              </div>
              <h3 className="text-base font-medium text-ink mb-1.5">专业测评</h3>
              <p className="text-ink-secondary text-sm leading-relaxed">每个题型3道题目，基于行测真实权重科学评分</p>
            </div>
            <div className="bg-surface border border-border rounded-xl p-6">
              <div className="w-10 h-10 rounded-lg bg-accent-soft text-accent flex items-center justify-center mb-4">
                <ChartIcon className="w-5 h-5" />
              </div>
              <h3 className="text-base font-medium text-ink mb-1.5">能力雷达图</h3>
              <p className="text-ink-secondary text-sm leading-relaxed">可视化展示个人能力分布，识别优劣势</p>
            </div>
            <div className="bg-surface border border-border rounded-xl p-6">
              <div className="w-10 h-10 rounded-lg bg-accent-soft text-accent flex items-center justify-center mb-4">
                <SparkleIcon className="w-5 h-5" />
              </div>
              <h3 className="text-base font-medium text-ink mb-1.5">学习路径</h3>
              <p className="text-ink-secondary text-sm leading-relaxed">基于测评结果，智能生成个性化训练计划</p>
            </div>
          </div>

          {/* 题库配置详情 */}
          <AssessmentStats />

          {/* 测评流程 */}
          <div className="bg-surface border border-border rounded-xl p-6 mb-8">
            <h2 className="font-serif text-xl font-semibold text-ink mb-6">测评流程</h2>
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              {[
                { step: 1, title: "开始测评", desc: "每个题型回答3道题目", icon: <ArrowRightIcon className="w-6 h-6" /> },
                { step: 2, title: "AI分析", desc: "智能评估各项能力", icon: <SparkleIcon className="w-6 h-6" /> },
                { step: 3, title: "生成档案", desc: "建立个人能力档案", icon: <FileTextIcon className="w-6 h-6" /> },
                { step: 4, title: "制定计划", desc: "获得学习建议", icon: <CheckIcon className="w-6 h-6" /> },
              ].map((item, index) => (
                <div key={index} className="flex-1 text-center">
                  <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-accent-soft text-accent flex items-center justify-center">
                    {item.icon}
                  </div>
                  <h3 className="text-sm font-medium text-ink mb-1">步骤 {item.step}</h3>
                  <p className="text-base font-medium text-ink mb-1">{item.title}</p>
                  <p className="text-xs text-ink-secondary">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 开始测评按钮 */}
          <div className="text-center">
            <p className="text-ink-secondary mb-6">
              完全免费的AI能力诊断，基于真题题库，为您制定个性化学习方案
            </p>
            <Button
              onClick={startAssessment}
              disabled={loading}
              size="lg"
              className="px-12 h-14"
            >
              {loading ? '正在准备...' : (
                <>
                  <SparkleIcon className="w-4 h-4" />
                  开始能力测评
                </>
              )}
            </Button>
            <p className="text-sm text-ink-tertiary mt-4">
              共18道题目（6个题型×3道） | 预计15-30分钟 | 即时获得专业评价
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// 测评界面组件
function TestingInterface({ 
  questions, 
  currentQuestion, 
  answers, 
  onSubmitAnswer, 
  onNext, 
  loading,
  lastSelectedAnswer 
}: {
  questions: Question[];
  currentQuestion: number;
  answers: { [key: string]: string };
  onSubmitAnswer: (questionId: string, answer: string) => void;
  onNext: () => void;
  loading: boolean;
  lastSelectedAnswer: string;
}) {
  const question = questions[currentQuestion];
  const [selectedAnswer, setSelectedAnswer] = useState('');
  
  // 使用useEffect来处理题目切换时的默认答案设置
  useEffect(() => {
    if (question) {
      const questionId = question.id.toString();
      const existingAnswer = answers[questionId];
      
      if (existingAnswer) {
        // 如果当前题目已有答案，使用现有答案
        setSelectedAnswer(existingAnswer);
        console.log('[DEBUG] 使用已有答案:', existingAnswer);
      } else if (lastSelectedAnswer && currentQuestion > 0) {
        // 如果是第二题及之后，且没有现有答案，使用上一题的选择作为默认值
        setSelectedAnswer(lastSelectedAnswer);
        onSubmitAnswer(questionId, lastSelectedAnswer);
        console.log('[DEBUG] 使用默认答案:', lastSelectedAnswer);
      } else {
        // 第一题或没有上一题选择记录
        setSelectedAnswer('');
      }
    }
  }, [question, answers, lastSelectedAnswer, currentQuestion, onSubmitAnswer]);

  // 键盘事件处理 - 支持回车键快速下一题
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === 'Enter' && selectedAnswer && !loading) {
        event.preventDefault();
        onNext();
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => {
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, [selectedAnswer, loading, onNext]);
  
  if (!question) {
    return <div>加载中...</div>;
  }

  const handleAnswerSelect = (answer: string) => {
    setSelectedAnswer(answer);
    onSubmitAnswer(question.id.toString(), answer);
  };

  const isLastQuestion = currentQuestion === questions.length - 1;
  const canProceed = selectedAnswer !== '';

  return (
    <div className="min-h-screen bg-canvas pb-16 lg:pb-0 lg:pl-60">
      <Navigation />
      
      <div className="py-8 px-4">
        <div className="max-w-4xl mx-auto">
          {/* 进度条 */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-ink">
                题目 {currentQuestion + 1} / {questions.length}
              </span>
              <span className="text-sm text-ink-secondary">
                {Math.round(((currentQuestion + 1) / questions.length) * 100)}% 完成
              </span>
            </div>
            <div className="w-full bg-surface-muted rounded-full h-2">
              <div 
                className="bg-accent h-2 rounded-full transition-all duration-300"
                style={{ width: `${((currentQuestion + 1) / questions.length) * 100}%` }}
              ></div>
            </div>
          </div>

          {/* 题目卡片 */}
          <div className="bg-surface border border-border rounded-xl p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif text-lg font-semibold text-ink">{question.title}</h2>
              <div className="bg-accent-soft text-accent px-3 py-1 rounded-full text-sm font-medium">
                {question.question_type || '未知题型'}
              </div>
            </div>
            
            <div className="prose max-w-none mb-6">
              {/* 显示材料图片 */}
              {question.images && question.images.filter(img => img.image_type === 'material' || !img.image_type).length > 0 && (
                <div className="mb-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {question.images
                      .filter(img => img.image_type === 'material' || !img.image_type)
                      .map((image, index) => (
                        <div key={image.id} className="border border-border rounded-lg overflow-hidden">
                          <img 
                            src={image.url}
                            alt={`题目图片 ${index + 1}`}
                            className="w-full h-auto"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                          {image.context_text && (
                            <div className="p-2 bg-surface-muted text-xs text-ink-secondary">
                              {image.context_text}
                            </div>
                          )}
                        </div>
                      ))
                    }
                  </div>
                </div>
              )}
              
              <div className="text-ink leading-relaxed whitespace-pre-line">
                {question.content}
              </div>
            </div>

            {/* 选项 */}
            <div className="space-y-3">
              {Object.entries(question.options).map(([key, value]) => {
                // 查找该选项对应的图片
                const optionImages = question.images?.filter(img => 
                  img.image_type === 'option' && 
                  img.context_text?.trim().startsWith(key)
                ) || [];
                
                return (
                  <label 
                    key={key}
                    className={`flex items-start p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                      selectedAnswer === key 
                        ? 'border-accent bg-accent-soft' 
                        : 'border-border hover:border-accent/50 hover:bg-surface-muted'
                    }`}
                  >
                    <input
                      type="radio"
                      name={`question-${question.id}`}
                      value={key}
                      checked={selectedAnswer === key}
                      onChange={(e) => handleAnswerSelect(e.target.value)}
                      className="mt-1 mr-4 accent-accent"
                    />
                    <div className="flex-1">
                      <div className="flex items-start space-x-3">
                        <div className="flex-1">
                          <span className="font-medium text-ink mr-2">{key}.</span>
                          <span className="text-ink-secondary">{value}</span>
                        </div>
                        
                        {/* 显示选项图片 */}
                        {optionImages.length > 0 && (
                          <div className="flex-shrink-0 w-32">
                            {optionImages.map((image, imgIndex) => (
                              <img 
                                key={image.id}
                                src={image.url}
                                alt={`选项 ${key} 图片`}
                                className="w-full h-auto rounded border border-border"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex justify-between items-center">
            <div className="text-sm text-ink-secondary">
              {currentQuestion > 0 && selectedAnswer && answers[question.id.toString()] === lastSelectedAnswer ? (
                <span className="text-accent">
                  已自动选择与上一题相同的选项，您可以点击更改
                </span>
              ) : (
                '请选择最合适的答案'
              )}
            </div>
            
            <Button
              onClick={onNext}
              disabled={!canProceed || loading}
              size="lg"
            >
              {loading ? '提交中...' : isLastQuestion ? '完成测评' : '下一题 (回车键)'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// 结果展示组件  
function ResultInterface({ 
  result, 
  onReset 
}: {
  result: AssessmentResult | null;
  onReset: () => void;
}) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [filterType, setFilterType] = useState<'all' | 'correct' | 'wrong' | string>('all');
  const [showBackToTop, setShowBackToTop] = useState(false);

  // 获取筛选后的题目列表
  const getFilteredQuestions = useCallback(() => {
    if (!result?.detailed_scores) return [];
    return result.detailed_scores.filter((detail: any) => {
      if (filterType === 'all') return true;
      if (filterType === 'correct') return detail.correct;
      if (filterType === 'wrong') return !detail.correct;
      return detail.question_type === filterType;
    });
  }, [result?.detailed_scores, filterType]);

  // 上一题
  const goToPreviousQuestion = useCallback(() => {
    setCurrentQuestionIndex(prev => Math.max(0, prev - 1));
  }, []);

  // 下一题  
  const goToNextQuestion = useCallback(() => {
    const filteredQuestions = getFilteredQuestions();
    setCurrentQuestionIndex(prev => Math.min(filteredQuestions.length - 1, prev + 1));
  }, [getFilteredQuestions]);

  // 跳转到指定题目
  const goToQuestion = (index: number) => {
    setCurrentQuestionIndex(index);
  };

  // 回到顶部
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 当筛选条件改变时，重置到第一题
  const handleFilterChange = (newFilterType: string) => {
    setFilterType(newFilterType);
    setCurrentQuestionIndex(0);
  };

  // 开始个性化练习
  const startPersonalizedPractice = () => {
    if (!result) return;
    
    // 保存测评结果到localStorage以便练习页面使用
    try {
      localStorage.setItem('assessment_result_for_practice', JSON.stringify({
        result: result,
        timestamp: new Date().toISOString()
      }));
      
      // 跳转到个性化练习页面
      window.location.href = '/practice';
    } catch (error) {
      console.error('保存测评结果失败:', error);
      alert('启动个性化练习失败，请稍后重试');
    }
  };

  // 监听滚动，显示/隐藏回到顶部按钮
  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 300);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // 键盘导航支持
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        goToPreviousQuestion();
      } else if (event.key === 'ArrowRight') {
        goToNextQuestion();
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => {
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, [goToPreviousQuestion, goToNextQuestion]);

  if (!result) {
    return <div>加载结果中...</div>;
  }

  // 获取筛选后的题目
  const filteredQuestions = getFilteredQuestions();
  const currentQuestion = filteredQuestions[currentQuestionIndex];
  const totalFilteredQuestions = filteredQuestions.length;

  // 维度名称映射 - 直接使用行测题型
  const dimensionNames: { [key: string]: { name: string; icon: string; color: string } } = {
    '政治理论': { name: '政治理论', icon: '政', color: 'text-accent' },
    '常识判断': { name: '常识判断', icon: '常', color: 'text-success' },
    '言语理解与表达': { name: '言语理解与表达', icon: '言', color: 'text-warning' },
    '数量关系': { name: '数量关系', icon: '数', color: 'text-danger' },
    '判断推理': { name: '判断推理', icon: '判', color: 'text-accent' },
    '资料分析': { name: '资料分析', icon: '资', color: 'text-success' }
  };

  const getScoreLevel = (score: number) => {
    if (score >= 90) return { level: '优秀', color: 'text-success', bgColor: 'bg-success/10' };
    if (score >= 80) return { level: '良好', color: 'text-accent', bgColor: 'bg-accent-soft' };
    if (score >= 70) return { level: '中等', color: 'text-warning', bgColor: 'bg-warning/10' };
    if (score >= 60) return { level: '及格', color: 'text-ink', bgColor: 'bg-surface-muted' };
    return { level: '需提升', color: 'text-danger', bgColor: 'bg-danger/10' };
  };

  const totalScoreLevel = getScoreLevel(result.total_score);

  return (
    <div className="min-h-screen bg-canvas pb-16 lg:pb-0 lg:pl-60">
      <Navigation />
      
      <div className="py-8 px-4">
        <div className="max-w-6xl mx-auto">
          {/* 标题 */}
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-serif font-semibold text-ink mb-2">
              测评完成
            </h1>
            <p className="text-ink-secondary text-base md:text-lg">
              恭喜您完成能力测评！以下是您的专业能力分析报告
            </p>
          </div>

          {/* 总分展示 */}
          <div className="bg-surface border border-border rounded-xl p-6 mb-8 text-center">
            <h2 className="font-serif text-xl font-semibold text-ink mb-4">综合评分</h2>
            <div className="mb-4">
              <span className="text-5xl font-serif font-bold text-ink">
                {result.total_score}
              </span>
              <span className="text-lg text-ink-secondary ml-2">分</span>
            </div>
            <div className={`inline-block px-4 py-2 rounded-full ${totalScoreLevel.bgColor} ${totalScoreLevel.color} text-sm font-medium`}>
              {totalScoreLevel.level}
            </div>
            <p className="text-ink-secondary mt-4">
              完成时间：{Math.floor((result.completion_time || 0) / 60)} 分 {(result.completion_time || 0) % 60} 秒
            </p>
          </div>

          {/* 各维度得分 */}
          <div className="bg-surface border border-border rounded-xl p-6 mb-8">
            <h2 className="font-serif text-xl font-semibold text-ink mb-6">各题型能力分析</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* 雷达图 */}
              <div className="flex justify-center">
                <RadarChart 
                  data={result.dimension_scores}
                  dimensions={dimensionNames}
                  size={350}
                />
              </div>
              
              {/* 详细分数列表 */}
              <div className="space-y-4">
                {Object.entries(result.dimension_scores).map(([key, score]) => {
                  const dimension = dimensionNames[key];
                  const scoreLevel = getScoreLevel(score);
                  
                  if (!dimension) return null;
                  
                  return (
                    <div key={key} className="bg-surface-muted rounded-xl p-4 border border-border">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center">
                          <span className={`w-8 h-8 mr-3 rounded-lg bg-accent-soft ${dimension.color} flex items-center justify-center text-sm font-serif font-semibold`}>
                            {dimension.name.charAt(0)}
                          </span>
                          <span className="font-medium text-ink">{dimension.name}</span>
                        </div>
                        <span className={`font-bold font-serif text-lg ${dimension.color}`}>
                          {score}分
                        </span>
                      </div>
                      
                      <div className="w-full bg-border rounded-full h-2 mb-2">
                        <div 
                          className={`h-2 rounded-full transition-all duration-500 ${
                            score >= 80 ? 'bg-success' :
                            score >= 70 ? 'bg-accent' :
                            score >= 60 ? 'bg-warning' : 'bg-danger'
                          }`}
                          style={{ width: `${score}%` }}
                        ></div>
                      </div>
                      
                      <div className={`text-center text-xs font-medium px-2 py-1 rounded ${scoreLevel.bgColor} ${scoreLevel.color}`}>
                        {scoreLevel.level}
                      </div>
                    </div>
                  );
                })}
                
                {/* 显示参与题型统计 */}
                <div className="mt-4 p-3 bg-accent-soft border border-accent/20 rounded-lg">
                  <p className="text-sm text-ink flex items-start gap-1.5">
                    <ChartIcon className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                    <span>
                      <span className="font-semibold">本次测评：</span>
                      共参与 {Object.keys(result.dimension_scores).length} 个题型的测评
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 答题详情 */}
          {result.detailed_scores && result.detailed_scores.length > 0 && totalFilteredQuestions > 0 && (
            <div className="bg-surface border border-border rounded-xl p-6 mb-8">
              {/* 标题和筛选 */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-6">
                <h2 className="font-serif text-xl font-semibold text-ink mb-4 lg:mb-0">
                  答题详情 ({result.detailed_scores.length}道题)
                </h2>
              </div>

              {/* 筛选选项 */}
              <div className="mb-6">
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleFilterChange('all')}
                    className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                      filterType === 'all' 
                        ? 'bg-accent text-white' 
                        : 'bg-surface border border-border text-ink-secondary hover:bg-surface-muted'
                    }`}
                  >
                    全部 ({result.detailed_scores.length})
                  </button>
                  <button
                    onClick={() => handleFilterChange('wrong')}
                    className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                      filterType === 'wrong' 
                        ? 'bg-danger text-white' 
                        : 'bg-surface border border-border text-ink-secondary hover:bg-surface-muted'
                    }`}
                  >
                    错题 ({result.detailed_scores.filter((d: any) => !d.correct).length})
                  </button>
                  <button
                    onClick={() => handleFilterChange('correct')}
                    className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                      filterType === 'correct' 
                        ? 'bg-success text-white' 
                        : 'bg-surface border border-border text-ink-secondary hover:bg-surface-muted'
                    }`}
                  >
                    正确 ({result.detailed_scores.filter((d: any) => d.correct).length})
                  </button>
                  
                  {/* 按题型筛选 */}
                  {Array.from(new Set(result.detailed_scores.map((d: any) => d.question_type))).map((type: any) => (
                    <button
                      key={type}
                      onClick={() => handleFilterChange(type)}
                      className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                        filterType === type 
                          ? 'bg-accent text-white' 
                          : 'bg-surface border border-border text-ink-secondary hover:bg-surface-muted'
                      }`}
                    >
                      {type} ({result.detailed_scores.filter((d: any) => d.question_type === type).length})
                    </button>
                  ))}
                </div>
              </div>

              {/* 进度指示器和题目导航 */}
              <div className="mb-6">
                {/* 进度条 */}
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-medium text-ink">
                    第 {currentQuestionIndex + 1} 题，共 {totalFilteredQuestions} 题
                  </span>
                  <span className="text-sm text-ink-secondary">
                    {Math.round(((currentQuestionIndex + 1) / totalFilteredQuestions) * 100)}% 完成
                  </span>
                </div>
                <div className="w-full bg-surface-muted rounded-full h-2 mb-4">
                  <div 
                    className="bg-accent h-2 rounded-full transition-all duration-300"
                    style={{ width: `${((currentQuestionIndex + 1) / totalFilteredQuestions) * 100}%` }}
                  ></div>
                </div>

                {/* 题目导航缩略图 */}
                <div className="bg-surface-muted rounded-lg p-4">
                  <h3 className="text-sm font-medium text-ink mb-3">题目导航（点击跳转）</h3>
                  <div className="grid grid-cols-6 sm:grid-cols-9 lg:grid-cols-12 xl:grid-cols-18 gap-2">
                    {filteredQuestions.map((detail: any, index: number) => {
                      const originalIndex = result.detailed_scores.findIndex((d: any) => d.question_id === detail.question_id);
                      
                      return (
                        <button
                          key={detail.question_id}
                          onClick={() => goToQuestion(index)}
                          className={`w-8 h-8 text-xs font-medium rounded-lg transition-all duration-200 ${
                            detail.correct 
                              ? 'bg-success/10 text-success hover:bg-success/20 border-2 border-success/30' 
                              : 'bg-danger/10 text-danger hover:bg-danger/20 border-2 border-danger/30'
                          } ${
                            index === currentQuestionIndex ? 'ring-2 ring-accent scale-110' : ''
                          }`}
                          title={`题目${originalIndex + 1}: ${detail.question_title} (${detail.correct ? '正确' : '错误'})`}
                        >
                          {originalIndex + 1}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-4 mt-3 text-xs text-ink-secondary">
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-success/10 border-2 border-success/30 rounded"></div>
                      <span>正确</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-danger/10 border-2 border-danger/30 rounded"></div>
                      <span>错误</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 border-2 border-accent rounded ring-1 ring-accent"></div>
                      <span>当前题目</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 当前题目详情 */}
              {currentQuestion && (
                <div className="relative">
                  {/* 左右导航按钮 */}
                  <div className="absolute inset-y-0 left-0 flex items-center z-10">
                    <button
                      onClick={goToPreviousQuestion}
                      disabled={currentQuestionIndex === 0}
                      className="bg-surface border border-border rounded-full p-3 hover:bg-surface-muted transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed -ml-6"
                      title="上一题 (←)"
                    >
                      <svg className="w-6 h-6 text-ink-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                  </div>
                  
                  <div className="absolute inset-y-0 right-0 flex items-center z-10">
                    <button
                      onClick={goToNextQuestion}
                      disabled={currentQuestionIndex === totalFilteredQuestions - 1}
                      className="bg-surface border border-border rounded-full p-3 hover:bg-surface-muted transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed -mr-6"
                      title="下一题 (→)"
                    >
                      <svg className="w-6 h-6 text-ink-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>

                  {/* 题目内容 */}
                  <div className="bg-surface-muted rounded-xl border border-border p-6 mx-8">
                    {/* 题目标题 */}
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3 flex-1">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-base font-serif font-semibold ${
                          currentQuestion.correct 
                            ? 'bg-success/10 text-success' 
                            : 'bg-danger/10 text-danger'
                        }`}>
                          {result.detailed_scores.findIndex((d: any) => d.question_id === currentQuestion.question_id) + 1}
                        </div>
                        
                        <div className="flex-1">
                          <h3 className="font-medium text-ink text-lg mb-1">
                            {currentQuestion.question_title || `第${result.detailed_scores.findIndex((d: any) => d.question_id === currentQuestion.question_id) + 1}题`}
                          </h3>
                          <div className="flex items-center gap-4 text-sm text-ink-secondary">
                            <span>题型: {currentQuestion.question_type || '未知'}</span>
                            <span>题号: {currentQuestion.question_number || '未知'}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className={`px-4 py-2 rounded-full text-sm font-medium ${
                        currentQuestion.correct ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
                      }`}>
                        {currentQuestion.correct ? '✓ 正确' : '✗ 错误'}
                      </div>
                    </div>

                    {/* 题目图片 */}
                    {currentQuestion.question_images && currentQuestion.question_images.filter((img: any) => img.image_type === 'material' || !img.image_type).length > 0 && (
                      <div className="mb-6">
                        <h4 className="text-sm font-medium text-ink mb-3">题目材料:</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {currentQuestion.question_images
                            .filter((img: any) => img.image_type === 'material' || !img.image_type)
                            .map((image: any, imgIndex: number) => (
                              <div key={image.id} className="border border-border rounded-lg overflow-hidden">
                                <img 
                                  src={image.url}
                                  alt={`题目图片 ${imgIndex + 1}`}
                                  className="w-full h-auto"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                  }}
                                />
                                {image.context_text && (
                                  <div className="p-2 bg-surface-muted text-xs text-ink-secondary">
                                    {image.context_text}
                                  </div>
                                )}
                              </div>
                            ))
                          }
                        </div>
                      </div>
                    )}

                    {/* 题目内容 */}
                    {currentQuestion.question_content && (
                      <div className="mb-6">
                        <h4 className="text-sm font-medium text-ink mb-3">题目内容:</h4>
                        <div className="bg-surface p-4 rounded-lg border border-border text-ink leading-relaxed whitespace-pre-line">
                          {currentQuestion.question_content}
                        </div>
                      </div>
                    )}

                    {/* 选项 */}
                    {currentQuestion.question_options && Object.keys(currentQuestion.question_options).length > 0 && (
                      <div className="mb-6">
                        <h4 className="text-sm font-medium text-ink mb-3">选项:</h4>
                        <div className="space-y-3">
                          {Object.entries(currentQuestion.question_options).map(([key, value]: [string, any]) => {
                            const optionImages = currentQuestion.question_images?.filter((img: any) => 
                              img.image_type === 'option' && 
                              img.context_text?.trim().startsWith(key)
                            ) || [];
                            
                            const isUserAnswer = currentQuestion.user_answer === key;
                            const isCorrectAnswer = currentQuestion.correct_answer === key;

                            return (
                              <div 
                                key={key}
                                className={`flex items-start p-4 rounded-lg border-2 ${
                                  isCorrectAnswer 
                                    ? 'border-success bg-success/5' 
                                    : isUserAnswer 
                                      ? (currentQuestion.correct ? 'border-success bg-success/5' : 'border-danger bg-danger/5')
                                      : 'border-border bg-surface'
                                }`}
                              >
                                <div className="flex-1">
                                  <div className="flex items-start space-x-3">
                                    <div className="flex-1">
                                      <span className={`font-semibold mr-3 text-lg ${
                                        isCorrectAnswer ? 'text-success' : 
                                        isUserAnswer ? (currentQuestion.correct ? 'text-success' : 'text-danger') : 'text-ink'
                                      }`}>
                                        {key}.
                                      </span>
                                      <span className={`text-lg ${
                                        isCorrectAnswer ? 'text-success' : 
                                        isUserAnswer ? (currentQuestion.correct ? 'text-success' : 'text-danger') : 'text-ink-secondary'
                                      }`}>
                                        {value}
                                      </span>
                                      {isUserAnswer && (
                                        <span className="ml-3 text-xs px-3 py-1 rounded-full bg-accent-soft text-accent font-medium">
                                          您的选择
                                        </span>
                                      )}
                                      {isCorrectAnswer && (
                                        <span className="ml-3 text-xs px-3 py-1 rounded-full bg-success/10 text-success font-medium">
                                          正确答案
                                        </span>
                                      )}
                                    </div>
                                    
                                    {/* 选项图片 */}
                                    {optionImages.length > 0 && (
                                      <div className="flex-shrink-0 w-32">
                                        {optionImages.map((image: any) => (
                                          <img 
                                            key={image.id}
                                            src={image.url}
                                            alt={`选项 ${key} 图片`}
                                            className="w-full h-auto rounded border border-border"
                                            onError={(e) => {
                                              e.currentTarget.style.display = 'none';
                                            }}
                                          />
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* 答案对比 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                      <div className="bg-surface p-4 rounded-lg border border-border">
                        <div className="text-sm font-medium text-ink-secondary mb-2">您的答案:</div>
                        <div className={`text-lg font-bold font-serif ${
                          currentQuestion.correct ? 'text-success' : 'text-danger'
                        }`}>
                          {currentQuestion.user_answer || '未作答'}
                        </div>
                      </div>
                      <div className="bg-surface p-4 rounded-lg border border-border">
                        <div className="text-sm font-medium text-ink-secondary mb-2">正确答案:</div>
                        <div className="text-lg font-bold font-serif text-success">
                          {currentQuestion.correct_answer || '未知'}
                        </div>
                      </div>
                    </div>
                    
                    {/* 解析 */}
                    {!currentQuestion.correct && currentQuestion.explanation && (
                      <div className="p-4 bg-accent-soft border border-accent/20 rounded-lg">
                        <div className="text-sm font-medium text-ink mb-3 flex items-center gap-1.5">
                          <FileTextIcon className="w-4 h-4 text-accent" />
                          题目解析:
                        </div>
                        <div className="text-sm text-ink-secondary leading-relaxed whitespace-pre-line">
                          {currentQuestion.explanation}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 底部统计 */}
              <div className="mt-8 text-center">
                <div className="flex items-center justify-center gap-6 text-sm text-ink-secondary">
                  <span>总计答对 {result.detailed_scores.filter((d: any) => d.correct).length} / {result.detailed_scores.length} 题</span>
                  <span>当前筛选: {totalFilteredQuestions} 题</span>
                  <span className="text-xs bg-surface-muted px-2 py-1 rounded">
                    使用 ← → 键快速翻页
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* 学习建议 */}
          {result.recommendations && result.recommendations.length > 0 && (
            <div className="bg-surface border border-border rounded-xl p-6 mb-8">
              <h2 className="font-serif text-xl font-semibold text-ink mb-6">专业学习建议</h2>
              
              <div className="space-y-6">
                {result.recommendations.map((rec: any, index: number) => (
                  <div key={index} className="border-l-4 border-accent pl-6">
                    <h3 className="text-base font-medium text-ink mb-2">
                      {rec.title}
                    </h3>
                    <p className="text-ink-secondary mb-3 leading-relaxed">{rec.content}</p>
                    {rec.suggestions && (
                      <ul className="space-y-1">
                        {rec.suggestions.map((suggestion: string, i: number) => (
                          <li key={i} className="text-ink-secondary text-sm flex items-start">
                            <span className="text-accent mr-2">•</span>
                            {suggestion}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}


          {/* 操作按钮 */}
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
            {/* 主要推荐按钮 */}
            <Button
              onClick={() => startPersonalizedPractice()}
              size="lg"
              className="px-8"
            >
              <SparkleIcon className="w-4 h-4" />
              开始个性化练习
            </Button>
            
            {/* 次要操作按钮 */}
            <div className="flex gap-3">
              <Button onClick={onReset} variant="secondary" size="lg">
                重新测评
              </Button>
              <Button onClick={() => window.print()} variant="secondary" size="lg">
                打印报告
              </Button>
            </div>
          </div>

          {/* 个性化练习说明 */}
          <div className="mt-6 text-center bg-accent-soft rounded-xl p-6 border border-accent/20">
            <h3 className="font-serif text-lg font-semibold text-ink mb-3">
              AI个性化学习推荐
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-danger/10 rounded-full flex items-center justify-center">
                  <XIcon className="w-4 h-4 text-danger" />
                </div>
                <div className="text-left">
                  <div className="font-medium text-ink">错题重练</div>
                  <div className="text-ink-secondary">针对错误题目深度练习</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-warning/10 rounded-full flex items-center justify-center">
                  <ChartIcon className="w-4 h-4 text-warning" />
                </div>
                <div className="text-left">
                  <div className="font-medium text-ink">薄弱专项</div>
                  <div className="text-ink-secondary">强化得分较低的题型</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-accent-soft rounded-full flex items-center justify-center">
                  <SparkleIcon className="w-4 h-4 text-accent" />
                </div>
                <div className="text-left">
                  <div className="font-medium text-ink">进阶提升</div>
                  <div className="text-ink-secondary">同类题型能力提升</div>
                </div>
              </div>
            </div>
          </div>

          {/* 回到顶部按钮 */}
          {showBackToTop && (
            <button
              onClick={scrollToTop}
              className="fixed bottom-6 right-6 bg-accent hover:bg-accent-hover text-white p-3 rounded-full transition-colors duration-200 z-50"
              title="回到顶部"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
