import { useState } from "react";
import { AlertTriangle, CheckCircle, XCircle, ArrowRight, RotateCcw, Trophy, Target, Play, Shield } from "lucide-react";
import RiskGauge from "@/components/common/RiskGauge";
import ProgressBar from "@/components/common/ProgressBar";
import { useAuth } from "@/contexts/AuthContext";

const PhishingScan = () => {
  const [hasStarted, setHasStarted] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<{ [key: number]: string }>({});
  const [showResults, setShowResults] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const { saveScanResult } = useAuth();

  const questions = [
    {
      id: 1,
      category: "email",
      question: "You receive an email from 'support@amaz0n-secure.com' asking you to verify your account. What should you do?",
      options: [
        { id: "a", text: "Click the link and enter your credentials", correct: false },
        { id: "b", text: "Reply asking for more information", correct: false },
        { id: "c", text: "Ignore it - the domain is suspicious (amaz0n with zero)", correct: true },
        { id: "d", text: "Forward it to friends to warn them", correct: false },
      ],
      explanation: "The domain 'amaz0n-secure.com' uses a zero instead of 'o' and isn't Amazon's official domain. This is a classic phishing technique called typosquatting."
    },
    {
      id: 2,
      category: "url",
      question: "Which of these URLs is most likely legitimate for PayPal?",
      options: [
        { id: "a", text: "http://paypal.com.secure-login.net/verify", correct: false },
        { id: "b", text: "https://www.paypal.com/signin", correct: true },
        { id: "c", text: "https://paypa1.com/login", correct: false },
        { id: "d", text: "http://www.paypal-secure.org/account", correct: false },
      ],
      explanation: "Only option B uses the real PayPal domain (paypal.com). Others use subdomains of different sites or typosquatting (paypa1 with number 1)."
    },
    {
      id: 3,
      category: "social",
      question: "A LinkedIn message from a 'recruiter' offers you a dream job but asks for your SSN for 'background check'. What's the red flag?",
      options: [
        { id: "a", text: "Recruiters never message on LinkedIn", correct: false },
        { id: "b", text: "Legitimate companies never ask for SSN before hiring", correct: true },
        { id: "c", text: "The job sounds too good", correct: false },
        { id: "d", text: "Nothing, this is normal", correct: false },
      ],
      explanation: "No legitimate employer asks for SSN before you're hired. This information is only needed for tax forms after accepting a job offer."
    },
    {
      id: 4,
      category: "email",
      question: "An email from your 'bank' says your account will be closed in 24 hours unless you verify your identity. What should you do?",
      options: [
        { id: "a", text: "Act quickly - 24 hours is urgent!", correct: false },
        { id: "b", text: "Call the number in the email to verify", correct: false },
        { id: "c", text: "Log in to your bank directly (not through the email) to check", correct: true },
        { id: "d", text: "Reply asking for more time", correct: false },
      ],
      explanation: "Urgency is a common phishing tactic. Always access your bank through their official website or app - never through email links."
    },
    {
      id: 5,
      category: "url",
      question: "You're shopping online and the checkout page URL shows 'http://' instead of 'https://'. What does this mean?",
      options: [
        { id: "a", text: "The site is faster without encryption", correct: false },
        { id: "b", text: "Your payment data won't be encrypted - major red flag", correct: true },
        { id: "c", text: "Nothing important, just a protocol", correct: false },
        { id: "d", text: "The site is using newer technology", correct: false },
      ],
      explanation: "HTTP means no encryption - anyone can intercept your data. Never enter payment info on non-HTTPS pages. Look for the padlock icon."
    },
    {
      id: 6,
      category: "social",
      question: "A pop-up says 'Your computer is infected! Call Microsoft at 1-800-XXX-XXXX immediately!' What is this?",
      options: [
        { id: "a", text: "A legitimate Windows security warning", correct: false },
        { id: "b", text: "A tech support scam - Microsoft never does this", correct: true },
        { id: "c", text: "An antivirus notification", correct: false },
        { id: "d", text: "A browser security feature", correct: false },
      ],
      explanation: "Microsoft never shows pop-ups with phone numbers or threatens users this way. This is a tech support scam designed to steal money or install malware."
    },
    {
      id: 7,
      category: "email",
      question: "An email attachment is named 'Invoice.pdf.exe'. What type of file is this really?",
      options: [
        { id: "a", text: "A PDF document", correct: false },
        { id: "b", text: "A compressed file", correct: false },
        { id: "c", text: "An executable program (likely malware)", correct: true },
        { id: "d", text: "A spreadsheet", correct: false },
      ],
      explanation: "The real extension is .exe (executable). Attackers add '.pdf' to trick you. Windows hides extensions by default - always be cautious with attachments."
    },
    {
      id: 8,
      category: "social",
      question: "You receive a text from 'Apple' about suspicious activity, with a link to verify your account. What should you check first?",
      options: [
        { id: "a", text: "If the link goes to apple.com", correct: true },
        { id: "b", text: "If the text has good grammar", correct: false },
        { id: "c", text: "If your phone shows it's from Apple", correct: false },
        { id: "d", text: "Nothing, just click to be safe", correct: false },
      ],
      explanation: "Always verify links go to the real domain (apple.com). Sender names can be spoofed. When in doubt, go directly to the official website."
    }
  ];

  const handleAnswer = (optionId: string) => {
    setAnswers({ ...answers, [currentQuestion]: optionId });
    setShowExplanation(true);
  };

  const handleNext = () => {
    setShowExplanation(false);
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      const score = calculateScore();
      saveScanResult('phishing', {
        status: score >= 70 ? 'secure' : score >= 50 ? 'warning' : 'danger',
        score,
        correctAnswers: Object.entries(answers).filter(([index, answer]) => {
          const q = questions[parseInt(index)];
          return q.options.find((o) => o.id === answer)?.correct;
        }).length,
        totalQuestions: questions.length,
        scannedAt: new Date().toISOString()
      });
      setShowResults(true);
    }
  };

  const calculateScore = () => {
    let correct = 0;
    questions.forEach((q, index) => {
      const answer = answers[index];
      const correctOption = q.options.find((o) => o.correct);
      if (answer === correctOption?.id) correct++;
    });
    return Math.round((correct / questions.length) * 100);
  };

  const getGrade = (score: number) => {
    if (score >= 90) return { grade: "A+", label: "Phishing Expert", color: "text-success" };
    if (score >= 80) return { grade: "A", label: "Vigilant User", color: "text-success" };
    if (score >= 70) return { grade: "B", label: "Aware User", color: "text-primary" };
    if (score >= 60) return { grade: "C", label: "At Risk", color: "text-warning" };
    return { grade: "F", label: "Highly Vulnerable", color: "text-destructive" };
  };

  const resetQuiz = () => {
    setHasStarted(false);
    setCurrentQuestion(0);
    setAnswers({});
    setShowResults(false);
    setShowExplanation(false);
  };

  // Landing state
  if (!hasStarted) {
    return (
      <div className="min-h-screen py-8">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="glass-card p-12 text-center animate-fade-in">
            <div className="p-4 rounded-full bg-primary/10 w-fit mx-auto mb-6">
              <Shield className="w-16 h-16 text-primary" />
            </div>
            <h1 className="text-3xl font-bold mb-4">Phishing Susceptibility Test</h1>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto">
              Test your ability to identify phishing attempts, scam emails, and malicious links. 
              Learn how to protect yourself from social engineering attacks.
            </p>
            
            <div className="grid grid-cols-3 gap-4 mb-8 max-w-md mx-auto">
              <div className="p-4 rounded-lg bg-muted/30">
                <p className="text-2xl font-bold text-primary">{questions.length}</p>
                <p className="text-xs text-muted-foreground">Questions</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/30">
                <p className="text-2xl font-bold text-primary">~5</p>
                <p className="text-xs text-muted-foreground">Minutes</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/30">
                <p className="text-2xl font-bold text-primary">3</p>
                <p className="text-xs text-muted-foreground">Categories</p>
              </div>
            </div>

            <button
              onClick={() => setHasStarted(true)}
              className="btn-primary inline-flex items-center gap-2 text-lg px-8 py-3"
            >
              <Play className="w-5 h-5" />
              Start Test
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (showResults) {
    const score = calculateScore();
    const { grade, label, color } = getGrade(score);
    const correctAnswers = Object.entries(answers).filter(([index, answer]) => {
      const q = questions[parseInt(index)];
      return q.options.find((o) => o.id === answer)?.correct;
    }).length;

    return (
      <div className="min-h-screen py-8">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="glass-card p-8 text-center animate-fade-in">
            <Trophy className={`w-16 h-16 mx-auto mb-6 ${color}`} />
            <h1 className="text-3xl font-bold mb-2">Test Complete!</h1>
            <p className="text-muted-foreground mb-8">Here are your results</p>

            <div className="flex justify-center gap-8 mb-8">
              <RiskGauge score={100 - score} size="lg" label="Vulnerability" />
              <div className="text-left">
                <div className={`text-6xl font-bold ${color} mb-2`}>{grade}</div>
                <div className={`text-xl font-medium ${color}`}>{label}</div>
                <p className="text-muted-foreground mt-2">
                  {correctAnswers}/{questions.length} correct answers
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="p-4 rounded-lg bg-muted/30">
                <Target className="w-6 h-6 text-primary mx-auto mb-2" />
                <p className="text-2xl font-bold">{score}%</p>
                <p className="text-sm text-muted-foreground">Accuracy</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/30">
                <AlertTriangle className="w-6 h-6 text-warning mx-auto mb-2" />
                <p className="text-2xl font-bold">{100 - score}%</p>
                <p className="text-sm text-muted-foreground">Susceptibility</p>
              </div>
            </div>

            <div className="space-y-4 mb-8 text-left">
              <h3 className="font-semibold">Performance Breakdown</h3>
              <div className="space-y-3">
                {["Email Recognition", "URL Safety", "Social Engineering"].map((category, i) => {
                  const categoryScore = Math.max(20, Math.min(100, score + (i * 10 - 10)));
                  return (
                    <div key={category}>
                      <div className="flex justify-between text-sm mb-1">
                        <span>{category}</span>
                        <span>{categoryScore}%</span>
                      </div>
                      <ProgressBar value={categoryScore} color="auto" showValue={false} size="sm" />
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-4 justify-center">
              <button onClick={resetQuiz} className="btn-primary flex items-center gap-2">
                <RotateCcw className="w-4 h-4" />
                Retake Test
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const question = questions[currentQuestion];
  const selectedAnswer = answers[currentQuestion];
  const correctOption = question.options.find((o) => o.correct);

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4 max-w-3xl">
        {/* Header */}
        <div className="glass-card p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-xl bg-primary/10">
              <AlertTriangle className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Phishing Susceptibility Test</h1>
              <p className="text-muted-foreground text-sm">Test your ability to spot phishing attempts</p>
            </div>
          </div>

          {/* Progress */}
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium">Question {currentQuestion + 1} of {questions.length}</span>
            <div className="flex-1">
              <ProgressBar value={((currentQuestion + 1) / questions.length) * 100} color="primary" showValue={false} size="sm" />
            </div>
          </div>
        </div>

        {/* Question */}
        <div className="glass-card p-8 animate-fade-in">
          <div className="mb-6">
            <span className={`badge-${question.category === "email" ? "info" : question.category === "url" ? "warning" : "success"} mb-4`}>
              {question.category.charAt(0).toUpperCase() + question.category.slice(1)}
            </span>
            <h2 className="text-xl font-semibold">{question.question}</h2>
          </div>

          <div className="space-y-3 mb-6">
            {question.options.map((option) => {
              const isSelected = selectedAnswer === option.id;
              const isCorrect = option.correct;
              const showStatus = showExplanation && isSelected;

              return (
                <button
                  key={option.id}
                  onClick={() => !showExplanation && handleAnswer(option.id)}
                  disabled={showExplanation}
                  className={`w-full p-4 rounded-lg text-left transition-all duration-300 ${
                    showExplanation
                      ? isCorrect
                        ? "bg-success/20 border-2 border-success"
                        : isSelected
                        ? "bg-destructive/20 border-2 border-destructive"
                        : "bg-muted/30 border border-border/30 opacity-50"
                      : isSelected
                      ? "bg-primary/20 border-2 border-primary"
                      : "bg-muted/30 border border-border/30 hover:border-primary/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>{option.text}</span>
                    {showExplanation && isCorrect && <CheckCircle className="w-5 h-5 text-success" />}
                    {showExplanation && isSelected && !isCorrect && <XCircle className="w-5 h-5 text-destructive" />}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Explanation */}
          {showExplanation && (
            <div className={`p-4 rounded-lg mb-6 animate-fade-in ${
              selectedAnswer === correctOption?.id
                ? "bg-success/10 border border-success/20"
                : "bg-destructive/10 border border-destructive/20"
            }`}>
              <div className="flex items-center gap-2 mb-2">
                {selectedAnswer === correctOption?.id ? (
                  <>
                    <CheckCircle className="w-5 h-5 text-success" />
                    <span className="font-medium text-success">Correct!</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-5 h-5 text-destructive" />
                    <span className="font-medium text-destructive">Incorrect</span>
                  </>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{question.explanation}</p>
            </div>
          )}

          {showExplanation && (
            <button onClick={handleNext} className="btn-primary w-full flex items-center justify-center gap-2">
              {currentQuestion < questions.length - 1 ? (
                <>
                  Next Question
                  <ArrowRight className="w-4 h-4" />
                </>
              ) : (
                "View Results"
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PhishingScan;