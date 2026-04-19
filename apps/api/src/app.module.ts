import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { BrandsModule } from './brands/brands.module';
import { ProductsModule } from './products/products.module';
import { ImportModule } from './import/import.module';
import { ExportModule } from './export/export.module';
import { PriceHistoryModule } from './price-history/price-history.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    BrandsModule,
    ProductsModule,
    ImportModule,
    ExportModule,
    PriceHistoryModule,
  ],
})
export class AppModule {}
