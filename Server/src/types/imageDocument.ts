export interface ImageDocument {
  imageName: string;
  rotation: number;
  timeOnImage: number;

  assignedTo: string | null;
  status: string;
  createdAt: Date;
  claimedAt: Date | null;
  finishedAt: Date | null;
  project: string;
}
