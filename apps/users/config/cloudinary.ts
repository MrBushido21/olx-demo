import { v2 as CloudinaryAPI, UploadApiErrorResponse, UploadApiResponse } from "cloudinary";
import fs from "fs";

export const uploadImageToCloudinary = async (file: Express.Multer.File) => {
  return await new Promise<UploadApiResponse>((resolve, reject) => {
    const uploadStream = CloudinaryAPI.uploader.upload_stream(
      (error: UploadApiErrorResponse | undefined, result: UploadApiResponse | undefined) => {
        if (error) {
          reject(error);
          return;
        }

        if (!result) {
          reject(new Error("Upload result is undefined"));
          return;
        }
        fs.unlink(file.path, () => {});
        resolve(result);
      }
    );
    const stream = fs.createReadStream(file.path)
    stream.pipe(uploadStream)
  });
}