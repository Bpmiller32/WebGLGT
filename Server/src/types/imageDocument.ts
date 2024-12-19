export interface ImageDocument {
  imageName: string;
  imageType: string;
  rotation: number;
  timeOnImage: number;

  groupText0: string;
  groupCoordinates0: string;
  groupText1: string;
  groupCoordinates1: string;
  groupText2: string;
  groupCoordinates2: string;

  assignedTo: string | null;
  status: string;
  createdAt: Date;
  claimedAt: Date | null;
  finishedAt: Date | null;
  project: string;
}
