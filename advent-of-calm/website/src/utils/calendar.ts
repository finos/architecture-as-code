export interface DayInfo {
  day: number;
  unlocked: boolean;
  title: string;
}

export function getDayTitle(day: number): string {
  const titles: Record<number, string> = {
    1: "Install CALM CLI and Initialize Your Architecture Repository",
    2: "Create Your First Node",
    3: "Connect Nodes with Relationships",
    4: "Install the CALM VSCode Extension",
    5: "Add Interfaces to Your Nodes",
    6: "Document with Metadata",
    7: "Build a Complete E-Commerce Microservice Architecture",
    8: "Add Controls for Non-Functional Requirements",
    9: "Model a Business Flow",
    10: "Link to an ADR",
    11: "Share Your Architecture with a Documentation Website",
    12: "Custom Documentation with CALM Widgets",
    13: "Custom Documentation with Handlebars Templates",
    14: "Use CALM as Your Expert Architecture Advisor",
    15: "Use CALM as Your Expert Operations Advisor",
    16: "Generate Operations Documentation with Docify",
    17: "Introduction to CALM Patterns",
    18: "Using Standards for Your Organization",
    19: "Enforcing Standards with Patterns",
    20: "Multi-Pattern Validation for Complete Compliance",
    21: "The Platform Team Challenge — Enterprise Architect",
    22: "The Platform Team Challenge — Product Developer",
    23: "The Platform Team Challenge — Security SME",
    24: "Congratulations — You've Completed Advent of CALM! 🎉"
  };
  return titles[day] || `Day ${day}`;
}

export function isUnlocked(day: number): boolean {
  const now = new Date();
  const unlockDate = new Date(2025, 11, day); // Month 11 = December

  return now >= unlockDate;
}

export function getAllDays(): DayInfo[] {
  return Array.from({ length: 24 }, (_, i) => {
    const day = i + 1;
    return {
      day,
      unlocked: isUnlocked(day),
      title: getDayTitle(day)
    };
  });
}
