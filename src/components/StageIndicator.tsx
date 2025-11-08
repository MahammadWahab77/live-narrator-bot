import { Check } from "lucide-react";

interface Stage {
  id: number;
  title: string;
  description: string;
}

interface StageIndicatorProps {
  stages: Stage[];
  currentStage: number;
}

const StageIndicator = ({ stages, currentStage }: StageIndicatorProps) => {
  return (
    <div className="relative">
      <div className="flex items-center justify-between">
        {stages.map((stage, index) => {
          const isComplete = stage.id < currentStage;
          const isCurrent = stage.id === currentStage;
          const isUpcoming = stage.id > currentStage;

          return (
            <div key={stage.id} className="flex flex-col items-center relative z-10">
              <div
                className={`
                  w-12 h-12 rounded-full flex items-center justify-center font-semibold
                  transition-all duration-300 border-2
                  ${
                    isComplete
                      ? "bg-success border-success text-success-foreground"
                      : isCurrent
                      ? "bg-primary border-primary text-primary-foreground scale-110"
                      : "bg-muted border-border text-muted-foreground"
                  }
                `}
              >
                {isComplete ? <Check className="h-5 w-5" /> : stage.id}
              </div>
              <div className="mt-2 text-center">
                <p
                  className={`text-xs font-medium ${
                    isCurrent ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {stage.title}
                </p>
              </div>
              
              {index < stages.length - 1 && (
                <div
                  className={`absolute top-6 left-1/2 w-full h-0.5 -z-10 transition-all duration-300 ${
                    isComplete ? "bg-success" : "bg-border"
                  }`}
                  style={{ transform: "translateX(50%)" }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StageIndicator;
