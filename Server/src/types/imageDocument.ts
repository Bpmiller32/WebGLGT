export interface ImageDocument {
  imageName: string;
  imageType: string;
  rotation: number;
  timeOnImage: number;

  assignedTo: string | null;
  status: string;
  createdAt: Date;
  claimedAt: Date | null;
  finishedAt: Date | null;
  project: string;
}
