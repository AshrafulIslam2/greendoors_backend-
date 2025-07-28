// src/common/multer.config.ts

import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { memoryStorage } from 'multer';

export const multerConfig: MulterOptions = {
    storage: memoryStorage(),
    limits: {
        fileSize: 2 * 1024 * 1024, // 2MB limit (in bytes)
    },
};