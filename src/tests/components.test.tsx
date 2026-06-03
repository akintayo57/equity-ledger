import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { Card, CardHeader, CardContent, StatBox, Badge } from '../components/ui/Cards';
import { Modal, ConfirmDialog, AlertDialog } from '../components/ui/Modal';

describe('UI Cards components tests', () => {
  it('should render Card and CardContent with custom content and classes', () => {
    const { container } = render(
      <Card className="custom-card-class">
        <CardContent className="custom-content-class">
          <span>Card Body Content</span>
        </CardContent>
      </Card>
    );

    expect(screen.getByText('Card Body Content')).toBeInTheDocument();
    expect(container.firstChild).toHaveClass('custom-card-class');
    expect(container.querySelector('.custom-content-class')).toBeInTheDocument();
  });

  it('should render CardHeader with title and action', () => {
    const mockAction = <button>Action Button</button>;
    render(<CardHeader title="My Header Title" action={mockAction} />);

    expect(screen.getByText('My Header Title')).toBeInTheDocument();
    expect(screen.getByText('Action Button')).toBeInTheDocument();
  });

  it('should render StatBox with label, value, and subLabel', () => {
    render(
      <StatBox 
        label="Monthly Revenue" 
        value="$5,000" 
        subLabel="Compared to last month" 
        valueClass="text-emerald-500" 
      />
    );

    expect(screen.getByText('Monthly Revenue')).toBeInTheDocument();
    expect(screen.getByText('$5,000')).toBeInTheDocument();
    expect(screen.getByText('$5,000')).toHaveClass('text-emerald-500');
    expect(screen.getByText('Compared to last month')).toBeInTheDocument();
  });

  it('should render Badge with different color variants', () => {
    const { rerender } = render(<Badge variant="gray">Badge Content</Badge>);
    expect(screen.getByText('Badge Content')).toHaveClass('text-slate-600');

    rerender(<Badge variant="red">Badge Content</Badge>);
    expect(screen.getByText('Badge Content')).toHaveClass('text-rose-600');

    rerender(<Badge variant="green">Badge Content</Badge>);
    expect(screen.getByText('Badge Content')).toHaveClass('text-emerald-600');

    rerender(<Badge variant="yellow">Badge Content</Badge>);
    expect(screen.getByText('Badge Content')).toHaveClass('text-amber-600');

    rerender(<Badge variant="blue">Badge Content</Badge>);
    expect(screen.getByText('Badge Content')).toHaveClass('text-blue-600');
  });
});

describe('UI Modal components tests', () => {
  it('should render Modal when open and trigger onClose on close button click', () => {
    const onCloseMock = vi.fn();
    const { rerender } = render(
      <Modal isOpen={false} onClose={onCloseMock} title="My Test Modal">
        <div>Modal Children Content</div>
      </Modal>
    );

    expect(screen.queryByText('My Test Modal')).not.toBeInTheDocument();
    expect(screen.queryByText('Modal Children Content')).not.toBeInTheDocument();

    rerender(
      <Modal isOpen={true} onClose={onCloseMock} title="My Test Modal">
        <div>Modal Children Content</div>
      </Modal>
    );

    expect(screen.getByText('My Test Modal')).toBeInTheDocument();
    expect(screen.getByText('Modal Children Content')).toBeInTheDocument();

    // Click close icon button
    const closeBtn = screen.getByRole('button');
    fireEvent.click(closeBtn);
    expect(onCloseMock).toHaveBeenCalled();
  });

  it('should render ConfirmDialog and call onConfirm and onClose', () => {
    const onConfirmMock = vi.fn();
    const onCloseMock = vi.fn();

    render(
      <ConfirmDialog 
        isOpen={true} 
        onClose={onCloseMock} 
        onConfirm={onConfirmMock} 
        title="Are you sure?" 
        message="This action cannot be undone." 
        confirmText="Confirm Delete" 
        cancelText="Cancel Action"
        type="danger"
      />
    );

    expect(screen.getByText('Are you sure?')).toBeInTheDocument();
    expect(screen.getByText('This action cannot be undone.')).toBeInTheDocument();

    const cancelBtn = screen.getByText('Cancel Action');
    const confirmBtn = screen.getByText('Confirm Delete');

    fireEvent.click(cancelBtn);
    expect(onCloseMock).toHaveBeenCalled();

    fireEvent.click(confirmBtn);
    expect(onConfirmMock).toHaveBeenCalled();
    expect(onCloseMock).toHaveBeenCalled();
  });

  it('should render AlertDialog with success/error types', () => {
    const onCloseMock = vi.fn();

    const { rerender } = render(
      <AlertDialog 
        isOpen={true} 
        onClose={onCloseMock} 
        title="Success Status" 
        message="Action finished successfully." 
        type="success"
        buttonText="Okay"
      />
    );

    expect(screen.getByText('Success Status')).toBeInTheDocument();
    expect(screen.getByText('Action finished successfully.')).toBeInTheDocument();

    const okBtn = screen.getByText('Okay');
    fireEvent.click(okBtn);
    expect(onCloseMock).toHaveBeenCalled();

    rerender(
      <AlertDialog 
        isOpen={true} 
        onClose={onCloseMock} 
        title="Error Status" 
        message="Failed to update database." 
        type="error"
      />
    );

    expect(screen.getByText('Error Status')).toBeInTheDocument();
    expect(screen.getByText('Failed to update database.')).toBeInTheDocument();
  });
});
