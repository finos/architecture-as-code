export interface DayInfo {
  day: number;
  unlocked: boolean;
  title: string;
}

export function getDayTitle(day: number): string {
  const titles: Record<number, string> = {
    1: "Install CALM CLI and Initialize Repository",
    2: "Create Your First Node",
    3: "Connect Nodes with Relationships",
    4: "Install the CALM VSCode Extension",
    5: "Add Interfaces to Nodes",
    6: "Document with Metadata",
    7: "Build a Complete E-Commerce Microservice Architecture",
    8: "Create Your First Pattern",
    9: "Reverse-Engineer a Pattern from Your Architecture",
    10: "Add a Security Control",
    11: "Model a Business Flow",
    12: "Add Multiple Interface Types",
    13: "Link to an ADR",
    14: "Generate Documentation with Docify",
    15: "Create a Custom Template Bundle",
    16: "Set Up CALM Hub Locally",
    17: "Advanced AI-Powered Architecture Refactoring",
    18: "Automate Validation in CI/CD",
    19: "Model Your Actual System Architecture",
    20: "Add Deployment Topology",
    21: "Model Data Lineage",
    22: "Create a Migration from Existing Documentation",
    23: "Contribute to the CALM Community",
    24: "Present Your CALM Journey"
  };
  return titles[day] || `Day ${day}`;
}

export function isUnlocked(day: number): boolean {
  const now = new Date();
  const currentYear = now.getFullYear();
  const unlockDate = new Date(currentYear, 11, day); // Month 11 = December
  
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
