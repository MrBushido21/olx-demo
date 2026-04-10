import { v2 as CloudinaryAPI, UploadApiErrorResponse, UploadApiResponse } from "cloudinary";
import { Readable } from 'stream';

  export const uploadImageToCloudinary = async (file: Express.Multer.File) => {
    return new Promise<UploadApiResponse>((resolve, reject) => {
      const uploadStream = CloudinaryAPI.uploader.upload_stream(
        (error, result) => {
          if (error) return reject(error);
          if (!result) return reject(new Error("Upload result is undefined"));
          resolve(result);
        }
      );
      Readable.from(file.buffer).pipe(uploadStream);
    });
  }

export const deleteImageFromCloudinary = async (publicId:string) => {
  try {
    return await CloudinaryAPI.uploader.destroy(publicId)
  } catch (error) {
    console.error(error);
    throw new Error("Фото не удалено, попробуйте еще")
  }
}