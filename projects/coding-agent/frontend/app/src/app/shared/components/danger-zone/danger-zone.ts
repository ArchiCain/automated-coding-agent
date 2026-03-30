import { Component, Input, Output, EventEmitter, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmDialogComponent, ConfirmDialogData } from '../confirm-dialog/confirm-dialog';

export interface DangerAction {
  id: string;
  label: string;
  description: string;
  icon: string;
  confirmTitle: string;
  confirmMessage: string;
}

@Component({
  selector: 'app-danger-zone',
  standalone: true,
  imports: [
    CommonModule,
    MatExpansionModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './danger-zone.html',
  styleUrl: './danger-zone.scss',
})
export class DangerZoneComponent {
  private dialog = inject(MatDialog);

  @Input() actions: DangerAction[] = [];
  @Input() loading = false;
  @Input() loadingActionId: string | null = null;
  @Output() actionTriggered = new EventEmitter<string>();

  onActionClick(action: DangerAction): void {
    const dialogData: ConfirmDialogData = {
      title: action.confirmTitle,
      message: action.confirmMessage,
      confirmLabel: action.label,
      cancelLabel: 'Cancel',
      isDanger: true,
    };

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: dialogData,
      width: '400px',
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.actionTriggered.emit(action.id);
      }
    });
  }

  isActionLoading(actionId: string): boolean {
    return this.loading && this.loadingActionId === actionId;
  }
}
