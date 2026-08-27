export type MockEmployee = {
  id: string;
  name: string;
  eligible: boolean;
};

export const mockEmployees: MockEmployee[] = [
  { id: "1", name: "Employee 1", eligible: true },
  { id: "2", name: "Employee 2", eligible: true },
  { id: "3", name: "Employee 3", eligible: true },
  { id: "4", name: "Employee 4", eligible: true },
  { id: "5", name: "Employee 5", eligible: true },
  { id: "6", name: "Employee 6", eligible: false },
  { id: "7", name: "Employee 7", eligible: true },
];
