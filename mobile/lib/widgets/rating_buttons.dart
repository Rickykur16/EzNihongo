import 'package:flutter/material.dart';

class RatingButtons extends StatelessWidget {
  final void Function(int rating) onRated;

  const RatingButtons({super.key, required this.onRated});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        _btn(context, label: 'Lupa', rating: 1, color: const Color(0xFFE53935)),
        _gap(),
        _btn(context, label: 'Susah', rating: 2, color: const Color(0xFFFB8C00)),
        _gap(),
        _btn(context, label: 'Bisa', rating: 3, color: const Color(0xFF43A047)),
        _gap(),
        _btn(context, label: 'Mudah', rating: 4, color: const Color(0xFF1E88E5)),
      ],
    );
  }

  Widget _gap() => const SizedBox(width: 8);

  Widget _btn(BuildContext ctx,
      {required String label, required int rating, required Color color}) {
    return Expanded(
      child: FilledButton(
        onPressed: () => onRated(rating),
        style: FilledButton.styleFrom(
          backgroundColor: color,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(vertical: 16),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('$rating', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
            const SizedBox(height: 2),
            Text(label, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
          ],
        ),
      ),
    );
  }
}
