-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nipp` VARCHAR(20) NOT NULL,
    `nama` VARCHAR(100) NOT NULL,
    `password` VARCHAR(255) NOT NULL,
    `foto` VARCHAR(500) NULL,
    `role` VARCHAR(20) NOT NULL DEFAULT 'petugas',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_nipp_key`(`nipp`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tugas_ppj` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `jalur` VARCHAR(200) NOT NULL,
    `tanggal` DATE NOT NULL,
    `start_point_lat` DOUBLE NOT NULL,
    `start_point_long` DOUBLE NOT NULL,
    `end_point_lat` DOUBLE NOT NULL,
    `end_point_long` DOUBLE NOT NULL,
    `start_point_name` VARCHAR(200) NULL,
    `end_point_name` VARCHAR(200) NULL,
    `assigned_to` INTEGER NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tracking` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tugas_id` INTEGER NOT NULL,
    `start_time` DATETIME(3) NULL,
    `end_time` DATETIME(3) NULL,
    `start_lat` DOUBLE NULL,
    `start_long` DOUBLE NULL,
    `end_lat` DOUBLE NULL,
    `end_long` DOUBLE NULL,
    `durasi` INTEGER NULL DEFAULT 0,
    `status` VARCHAR(20) NOT NULL DEFAULT 'started',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `laporan` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tracking_id` INTEGER NOT NULL,
    `jenis_temuan` VARCHAR(20) NOT NULL,
    `deskripsi` TEXT NOT NULL,
    `foto` VARCHAR(500) NULL,
    `latitude` DOUBLE NOT NULL,
    `longitude` DOUBLE NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `tugas_ppj` ADD CONSTRAINT `tugas_ppj_assigned_to_fkey` FOREIGN KEY (`assigned_to`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tracking` ADD CONSTRAINT `tracking_tugas_id_fkey` FOREIGN KEY (`tugas_id`) REFERENCES `tugas_ppj`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `laporan` ADD CONSTRAINT `laporan_tracking_id_fkey` FOREIGN KEY (`tracking_id`) REFERENCES `tracking`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
