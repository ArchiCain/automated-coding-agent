import { NgModule } from '@angular/core';
import { HomePage } from './pages/home.page';
import { FeatureCardComponent } from './components/feature-card/feature-card.component';

@NgModule({
  imports: [HomePage, FeatureCardComponent],
  exports: [HomePage, FeatureCardComponent],
})
export class HomeModule {}
